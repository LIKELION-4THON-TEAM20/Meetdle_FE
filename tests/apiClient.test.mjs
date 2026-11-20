import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApiClient } from '../src/api/client.ts';

const session = { user: { userId: 'test-user', nickname: '테스트' }, csrfToken: 'test-csrf' };
const json = (value, status = 200) => Response.json(value, { status });

test('credentials, URL, 200/201 JSON 응답 및 204 응답을 처리한다', async () => {
  const client = createApiClient('https://example.test/api/', async (url, options) => {
    assert.equal(options.credentials, 'include');
    assert.equal(options.cache, 'no-store');
    if (url.pathname === '/api/me') return json(session);
    if (url.pathname === '/api/auth/logout') {
      assert.equal(options.method, 'POST');
      assert.equal(options.headers['X-CSRF-TOKEN'], session.csrfToken);
      assert.equal(options.headers['Content-Type'], undefined);
      return { ok: true, status: 204, text: () => assert.fail('204 must not be parsed') };
    }
    assert.equal(url.href, 'https://example.test/api/rooms?scope=ALL');
    return json({ roomId: 'id' }, 201);
  });

  assert.deepEqual(await client.get('/api/rooms', { query: { scope: 'ALL' } }), { roomId: 'id' });
  assert.deepEqual(await client.getSession(), session);
  assert.equal(await client.logout(), undefined);
});

test('동일 작업은 동시 실행을 합치고 실패 후 같은 본문과 키를 재사용한다', async () => {
  const writes = [];
  let sessionReads = 0;
  const client = createApiClient('https://example.test', async (url, options) => {
    if (url.pathname === '/api/me') {
      sessionReads++;
      return json(session);
    }
    writes.push(options);
    if (writes.length === 1) throw new TypeError('Network disconnected');
    return json({ roomId: 'id' }, 201);
  });

  const body = { title: 'first' };
  const operation = client.createMutation('POST', '/api/rooms', body, { idempotent: true });
  body.title = 'second';
  const first = operation.execute();
  assert.equal(operation.pending, true);
  assert.equal(first, operation.execute());
  await assert.rejects(first, { code: 'NETWORK_ERROR', status: null });
  assert.equal(operation.pending, false);
  await operation.execute();
  await operation.execute();
  await client.createMutation('POST', '/api/rooms', body, { idempotent: true }).execute();
  assert.equal(writes.length, 3);
  assert.equal(sessionReads, 1);
  const key = (request) => request.headers['Idempotency-Key'];
  assert.match(key(writes[0]), /^[a-f0-9-]{36}$/);
  assert.equal(key(writes[0]), key(writes[1]));
  assert.notEqual(key(writes[1]), key(writes[2]));
  assert.deepEqual(
    writes.map((write) => JSON.parse(write.body).title),
    ['first', 'first', 'second'],
  );
  assert.equal(writes[0].headers['X-CSRF-TOKEN'], session.csrfToken);
});

test('오류 코드, HTTP 상태, 비 JSON 오류와 요청 취소를 구분한다', async () => {
  let result;
  const client = createApiClient('https://example.test', async (_url, { signal }) => {
    signal?.throwIfAborted();
    return result;
  });
  for (const status of [400, 401, 403, 404, 409, 410, 429, 503]) {
    const code = status === 409 ? 'STALE_ROUND' : 'BACKEND_TEST_ERROR';
    result = json({ code, message: 'test', details: { round: 2 } }, status);
    await assert.rejects(client.get('/api/me'), { status, code, details: { round: 2 } });
  }
  result = new Response('Invalid CORS request', { status: 403 });
  await assert.rejects(client.get('/api/me'), { status: 403, code: 'HTTP_403' });
  result = new Response('Malformed JSON');
  await assert.rejects(client.get('/api/me'), { status: 200, code: 'INVALID_RESPONSE' });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(client.get('/api/me', { signal: controller.signal }), {
    name: 'AbortError',
  });
});

test('401 응답 후 세션을 다시 읽고 이전 세션의 쓰기 핸들을 폐기한다', async () => {
  let user = session;
  let reads = 0;
  const client = createApiClient('https://example.test', async (url) => {
    assert.equal(url.pathname, '/api/me');
    reads++;
    return user ? json(user) : json({ code: 'UNAUTHENTICATED', message: 'expired' }, 401);
  });
  const first = client.getSession();
  assert.equal(first, client.getSession({ refresh: true }));
  await first;
  const oldOperation = client.createMutation('POST', '/api/rooms', {}, { idempotent: true });
  user = null;
  await assert.rejects(client.getSession({ refresh: true }), { code: 'UNAUTHENTICATED' });
  user = { user: { userId: 'other-user', nickname: '다른 사용자' }, csrfToken: 'next-csrf' };
  assert.deepEqual(await client.getSession(), user);
  await assert.rejects(oldOperation.execute(), { code: 'SESSION_CHANGED' });
  assert.equal(reads, 3);
});

test('세션 초기화 후 늦게 도착한 조회 결과로 이전 세션을 복원하지 않는다', async () => {
  let resolveRead;
  const client = createApiClient(
    'https://example.test',
    () => new Promise((resolve) => (resolveRead = resolve)),
  );
  const pending = client.getSession();
  client.clearSession();
  resolveRead(json(session));
  await assert.rejects(pending, { code: 'SESSION_CHANGED' });
});
