import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
});
after(() => server.close());
const { createApiClient, ApiRequestError } = await server.ssrLoadModule('/src/api/client.ts');
const { createSessionStore } = await server.ssrLoadModule('/src/features/auth/session.ts');
const { createInvitationFlow } = await server.ssrLoadModule('/src/features/auth/invitations.ts');
const { toAppointment, roomEntryUrl } = await server.ssrLoadModule(
  '/src/features/homeApi/model.ts',
);
const { rememberLoginReturn, consumeLoginReturn, loginErrorMessage } = await server.ssrLoadModule(
  '/src/features/auth/loginReturn.ts',
);
const { authErrorMessage } = await server.ssrLoadModule('/src/features/auth/errors.ts');
const id = '12345678-1234-4234-8234-123456789abc';
const session = { user: { userId: 'user-a', nickname: '가' }, csrfToken: 'csrf-a' };
const preview = {
  roomId: id,
  title: null,
  dates: { from: '2026-11-19', through: '2026-11-21' },
  hostNickname: '방장',
  joinedCount: 2,
  capacity: 4,
  entryStatus: 'OPEN',
};
const json = (value, status = 200) => Response.json(value, { status });
const flowFor = (client, now) =>
  createInvitationFlow({
    getSession: client.getSession,
    subscribe: client.subscribeSession,
    resolve: (body) => client.createMutation('POST', '/api/invitations/resolve', body),
    join: (roomId, body) => client.createMutation('POST', `/api/rooms/${roomId}/join`, body),
    now,
  });

const { isPastRoom } = await server.ssrLoadModule('/src/features/homeApi/model.ts');
const { kakaoLoginOptions, clearMatchingLoginReturn } = await server.ssrLoadModule(
  '/src/features/auth/loginReturn.ts',
);
const { safeReturnTo } = await server.ssrLoadModule('/src/router/paths.ts');
const { createRoomHider } = await server.ssrLoadModule('/src/features/homeApi/hideRoom.ts');

test('세션 조회를 합치고 비로그인·연결 오류를 구분하며 성공한 로그아웃은 사용자 데이터를 폐기한다', async () => {
  let reads = 0;
  let result = json(session);
  const client = createApiClient('https://example.test', async (url, options) => {
    if (url.pathname === '/api/auth/logout') {
      assert.equal(options.headers['X-CSRF-TOKEN'], session.csrfToken);
      return new Response(null, { status: 204 });
    }
    reads++;
    return result.clone();
  });
  const store = createSessionStore(client);
  const first = store.refresh();
  assert.equal(store.refresh(), first);
  await first;
  assert.equal(reads, 1);
  assert.equal(store.getSnapshot().session.user.userId, 'user-a');
  await client.logout();
  assert.equal(store.getSnapshot().status, 'anonymous');
  assert.equal('session' in store.getSnapshot(), false);
  result = json({ code: 'UNAUTHENTICATED', message: 'expired' }, 401);
  await store.refresh();
  assert.equal(store.getSnapshot().status, 'anonymous');
  result = json({ code: 'HTTP_403', message: 'CORS refused' }, 403);
  await store.refresh();
  assert.equal(store.getSnapshot().status, 'error');
});

test('코드 확인과 가입을 분리하고 같은 세션의 증표로만 참여한다', async () => {
  const writes = [];
  const client = createApiClient('https://example.test', async (url, options) => {
    if (url.pathname === '/api/me') return json(session);
    writes.push({
      path: url.pathname,
      body: JSON.parse(options.body),
      csrf: options.headers['X-CSRF-TOKEN'],
    });
    if (url.pathname.endsWith('/resolve'))
      return json({ preview, joinProof: 'proof-a', joinProofExpiresAt: '2030-01-01T00:00:00Z' });
    return json({ roomId: id }, 201);
  });
  const flow = flowFor(client);
  await flow.resolve(' ab12cd ', 'a'.repeat(43));
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].body, { code: 'AB12CD', inviteToken: 'a'.repeat(43) });
  assert.equal(flow.peek(id, session).preview.roomId, id);
  const first = flow.join(id);
  await Promise.all([first, flow.join(id)]);
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[1].body, { joinProof: 'proof-a' });
  assert.equal(writes[1].csrf, session.csrfToken);
  client.clearSession();
  assert.equal(flow.peek(id, session), null);
  await assert.rejects(flow.join(id), { code: 'SESSION_CHANGED' });
  flow.dispose();
});

test('만료된 가입 증표는 같은 초대 코드로 재확인한 후 새 증표로 참여한다', async () => {
  let clock = 0;
  let resolves = 0;
  let proof;
  const client = createApiClient('https://example.test', async (url, options) => {
    if (url.pathname === '/api/me') return json(session);
    if (url.pathname.endsWith('/resolve')) {
      resolves++;
      return json({
        preview,
        joinProof: `proof-${resolves}`,
        joinProofExpiresAt: new Date(clock + 1000).toISOString(),
      });
    }
    proof = JSON.parse(options.body).joinProof;
    return json({ roomId: id });
  });
  const flow = flowFor(client, () => clock);
  await flow.resolve('AB12CD');
  clock = 2000;
  await flow.join(id);
  assert.equal(resolves, 2);
  assert.equal(proof, 'proof-2');
  flow.dispose();
});

test('정원 초과·참여 마감 응답에서 가입 요청을 보내지 않는다', async () => {
  for (const entryStatus of ['FULL', 'CLOSED']) {
    let writes = 0;
    const client = createApiClient('https://example.test', async (url) => {
      if (url.pathname === '/api/me') return json(session);
      writes++;
      return json({
        preview: { ...preview, entryStatus },
        joinProof: 'proof',
        joinProofExpiresAt: '2030-01-01T00:00:00Z',
      });
    });
    const flow = flowFor(client);
    await flow.resolve('AB12CD');
    await assert.rejects(flow.join(id), {
      code: entryStatus === 'FULL' ? 'ROOM_FULL' : 'JOIN_CLOSED',
    });
    assert.equal(writes, 1);
    flow.dispose();
  }
});

test('가입 응답을 받기 전에 세션이 바뀌면 이전 사용자 가입 결과를 사용하지 않는다', async () => {
  let finish;
  let current = session;
  const client = createApiClient('https://example.test', async (url) => {
    if (url.pathname === '/api/me') return json(current);
    if (url.pathname.endsWith('/resolve'))
      return json({ preview, joinProof: 'proof', joinProofExpiresAt: '2030-01-01T00:00:00Z' });
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const flow = flowFor(client);
  await flow.resolve('AB12CD');
  const joining = flow.join(id);
  while (!finish) await new Promise((resolve) => setImmediate(resolve));
  client.clearSession();
  current = { user: { userId: 'user-b', nickname: '나' }, csrfToken: 'csrf-b' };
  await client.getSession();
  finish(json({ roomId: id }));
  await assert.rejects(joining, { code: 'SESSION_CHANGED' });
  assert.equal(flow.peek(id, current), null);
  flow.dispose();
});

test('홈 DTO는 실제 인원수·서울 날짜·서버 단계를 보존하고 참가자 개인정보를 만들지 않는다', () => {
  const room = {
    ...preview,
    phase: 'REGION_CONFIRMED',
    meetingAt: '2026-11-19T16:00:00Z',
    endsAt: '2026-11-19T18:00:00Z',
  };
  const appointment = toAppointment(room);
  assert.equal(appointment.date, '2026-11-20');
  assert.equal(appointment.participantCount, 2);
  assert.deepEqual(appointment.participants, []);
  assert.equal(appointment.status, 'in-progress');
  assert.equal(appointment.entryPath, `/rooms/${id}`);
  assert.equal(toAppointment({ ...room, phase: 'ENDED', meetingAt: null }).date, '2026-11-19');
  assert.throws(() => roomEntryUrl('mock-room'));
});

test('OAuth 복귀는 허용된 내부 주소만 한 번 소비하며 취소·만료·제한 메시지를 구분한다', () => {
  const map = new Map();
  const storage = {
    setItem: (k, v) => map.set(k, v),
    getItem: (k) => map.get(k) ?? null,
    removeItem: (k) => map.delete(k),
  };
  rememberLoginReturn(storage, `/rooms/${id}`);
  assert.equal(consumeLoginReturn(storage), `/rooms/${id}`);
  assert.equal(consumeLoginReturn(storage), '/');
  rememberLoginReturn(storage, 'https://evil.test');
  assert.equal(consumeLoginReturn(storage), '/');
  assert.match(loginErrorMessage('access_denied'), /취소/);
  assert.match(
    authErrorMessage(new ApiRequestError(410, { code: 'INVITATION_EXPIRED', message: '' })),
    /만료/,
  );
  assert.match(
    authErrorMessage(new ApiRequestError(429, { code: 'RATE_LIMITED', message: '' })),
    /잠시 후/,
  );
});

test('로그아웃 후 늦게 도착한 이전 세션 조회 오류가 비로그인 상태를 덮지 않는다', async () => {
  let finishRead;
  let finishLogout;
  let reads = 0;
  const client = createApiClient('https://example.test', async (url) => {
    if (url.pathname === '/api/auth/logout')
      return new Promise((resolve) => {
        finishLogout = resolve;
      });
    if (++reads === 1) return json(session);
    return new Promise((resolve) => {
      finishRead = resolve;
    });
  });
  const store = createSessionStore(client);
  await store.refresh();
  const loggingOut = client.logout();
  while (!finishLogout) await new Promise((resolve) => setImmediate(resolve));
  const refresh = store.refresh();
  finishLogout(new Response(null, { status: 204 }));
  await loggingOut;
  finishRead(json({ code: 'FORBIDDEN', message: 'late error' }, 403));
  await refresh;
  assert.equal(store.getSnapshot().status, 'anonymous');
});

test('API 기본 주소가 없어도 앱을 중단하지 않고 세션 조회 오류 상태로 전환한다', async () => {
  const client = createApiClient(undefined, () =>
    assert.fail('invalid configuration must not fetch'),
  );
  const store = createSessionStore(client);
  await store.refresh();
  assert.equal(store.getSnapshot().status, 'error');
});

test('RESULT_READY와 지난 방 판정은 서버 단계·종료시각·후보 마지막 날짜를 사용한다', () => {
  const now = Date.parse('2026-11-19T12:00:00Z');
  const room = {
    ...preview,
    phase: 'RESULT_READY',
    meetingAt: '2026-11-19T09:00:00Z',
    endsAt: '2026-11-19T10:00:00Z',
  };
  assert.equal(toAppointment(room).badgeLabel, '최종 확정 대기');
  assert.equal(isPastRoom(room, now), true);
  assert.equal(isPastRoom({ ...room, endsAt: '2026-11-20T10:00:00Z' }, now), false);
  assert.equal(isPastRoom({ ...room, phase: 'ENDED', endsAt: '2027-01-01T00:00:00Z' }, now), true);
  assert.equal(
    isPastRoom(
      {
        ...room,
        meetingAt: null,
        endsAt: null,
        dates: { from: '2026-11-17', through: '2026-11-18' },
      },
      now,
    ),
    true,
  );
  assert.equal(
    isPastRoom(
      {
        ...room,
        meetingAt: null,
        endsAt: null,
        dates: { from: '2026-11-17', through: '2026-11-20' },
      },
      now,
    ),
    false,
  );
});

test('OAuth는 현재 Origin을 전달하고 서버 허용 경로와 초대 토큰을 함께 보내지 않는다', () => {
  const origin = 'http://localhost:5173';
  const token = 'a'.repeat(43);
  assert.deepEqual(kakaoLoginOptions(origin, `/rooms/${id}`), {
    returnTo: `/rooms/${id}`,
    returnOrigin: origin,
  });
  assert.deepEqual(kakaoLoginOptions(origin, '/'), { returnOrigin: origin });
  assert.deepEqual(kakaoLoginOptions(origin, '/rooms/schedule-transit?roomId=' + id), {
    returnOrigin: origin,
  });
  assert.deepEqual(kakaoLoginOptions(origin, `/rooms/${id}`, token), {
    inviteToken: token,
    returnOrigin: origin,
  });
  assert.throws(() => kakaoLoginOptions(origin, '/', 'invalid'));
  assert.equal(safeReturnTo('/rooms?loginError=CANCELLED'), '/rooms?loginError=CANCELLED');
  assert.equal(safeReturnTo('/invite/' + token), '/invite/' + token);
  assert.equal(safeReturnTo('//evil.test/rooms'), '/');
  assert.match(loginErrorMessage('CANCELLED'), /취소/);
  assert.match(loginErrorMessage('PROVIDER_UNAVAILABLE'), /완료하지 못/);
});

test('서버가 직접 방·초대로 복귀하면 같은 탭의 복귀 경로만 폐기한다', () => {
  const data = new Map();
  const storage = {
    setItem: (k, v) => data.set(k, v),
    getItem: (k) => data.get(k) ?? null,
    removeItem: (k) => data.delete(k),
  };
  rememberLoginReturn(storage, `/rooms/${id}`);
  clearMatchingLoginReturn(storage, '/rooms');
  assert.equal(data.size, 1);
  clearMatchingLoginReturn(storage, `/rooms/${id}`);
  assert.equal(data.size, 0);
});

test('지난 약속 숨김은 CSRF를 포함한 DELETE를 중복 방지하며 빈 200·204를 처리한다', async () => {
  for (const status of [200, 204]) {
    const writes = [];
    const client = createApiClient('https://example.test', async (url, options) => {
      if (url.pathname === '/api/me') return json(session);
      writes.push({ path: url.pathname, ...options });
      return new Response(null, { status });
    });
    const hider = createRoomHider(session, {
      getSession: client.getSession,
      hide: (roomId) =>
        client.createMutation('DELETE', `/api/rooms/${roomId}`, undefined, {
          discardResponse: true,
        }),
    });
    const first = hider.hide(id);
    assert.equal(first, hider.hide(id));
    await first;
    assert.equal(writes.length, 1);
    assert.equal(writes[0].method, 'DELETE');
    assert.equal(writes[0].body, undefined);
    assert.equal(writes[0].credentials, 'include');
    assert.equal(writes[0].headers['X-CSRF-TOKEN'], 'csrf-a');
    await assert.rejects(hider.hide('mock-room'));
  }
});

test('숨김 실패는 성공으로 처리하지 않고 재시도하며 사용자 변경을 거절한다', async () => {
  let status = 409;
  let writes = 0;
  let current = session;
  const client = createApiClient('https://example.test', async (url) => {
    if (url.pathname === '/api/me') return json(current);
    writes++;
    return status === 409
      ? json({ code: 'UPCOMING_ROOM', message: 'not past' }, 409)
      : new Response(null, { status: 204 });
  });
  const hider = createRoomHider(session, {
    getSession: client.getSession,
    hide: (roomId) =>
      client.createMutation('DELETE', `/api/rooms/${roomId}`, undefined, { discardResponse: true }),
  });
  await assert.rejects(hider.hide(id), { code: 'UPCOMING_ROOM' });
  assert.equal(writes, 1);
  status = 204;
  await hider.hide(id);
  assert.equal(writes, 2);
  client.clearSession();
  current = { user: { userId: 'other', nickname: '나' }, csrfToken: 'other-csrf' };
  await assert.rejects(hider.hide(id), { code: 'SESSION_CHANGED' });
  assert.equal(writes, 2);
});
