import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const roomId = '01234567-89ab-4cde-8f01-23456789abcd';
const deadline = '2026-11-20T09:00:00Z';
const requests = [];
let stateRoomId = roomId;
let detailResponse = false;
const registeredCandidate = {
  candidateId: 'abcdef01-2345-4cde-8f01-23456789abcd',
  place: {
    name: 'Test cafe',
    address: 'Test address',
    lat: 37.5,
    lng: 127,
    category: 'CAFE',
    detailUrl: null,
    imageUrl: null,
  },
};
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  const path = url.pathname;
  requests.push({ path, options, query: Object.fromEntries(url.searchParams) });
  if (path === '/api/me') {
    return Response.json({
      user: { userId: roomId, nickname: '테스트' },
      csrfToken: 'test-csrf',
    });
  }
  if (path.endsWith('/state')) {
    return Response.json(
      detailResponse
        ? {
            roomId,
            registration: { round: 2, myCandidates: [registeredCandidate] },
            allowedActions: ['EDIT_NOMINATION'],
          }
        : { roomId: stateRoomId, revision: 3 },
    );
  }
  if (path.endsWith('/share')) return Response.json({ purpose: 'RESULT', recipients: [] });
  if (path.endsWith('/candidates')) return Response.json({ candidateId: roomId });
  if (detailResponse) return new Response(null, { status: 204 });
  if (path.endsWith('/settings')) return new Response('OK');
  if (options.method === 'DELETE' || path.endsWith('/start') || path.endsWith('/confirmation')) {
    return new Response(null, { status: 200 });
  }
  return new Response(null, { status: 204 });
};

const server = await createServer({
  envDir: false,
  define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('https://example.test') },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
});
after(async () => {
  globalThis.fetch = realFetch;
  await server.close();
});
const { getRoomShare, getRoomState, roomMutations } =
  await server.ssrLoadModule('/src/api/rooms.ts');
const { getKakaoStartUrl } = await server.ssrLoadModule('/src/api/auth.ts');
const { toApiCategory, toUiCategory, toApiRole, toUiRole, toApiVote, toUiVote } =
  await server.ssrLoadModule('/src/api/mappers.ts');

test('RoomState는 서버 UUID만 요청하며 다른 방 응답을 거절한다', async () => {
  const before = requests.length;
  await assert.rejects(getRoomState('mock-room-10-14'), /server room UUID/);
  await assert.rejects(getRoomState('mock-created-preview'), /server room UUID/);
  assert.equal(requests.length, before);
  const signal = new AbortController().signal;
  assert.deepEqual(await getRoomState(roomId, signal), { roomId, revision: 3 });
  assert.equal(requests.at(-1).options.signal, signal);
  stateRoomId = 'abcdef01-2345-4cde-8f01-23456789abcd';
  await assert.rejects(getRoomState(roomId), /does not belong/);
});

test('요구된 API와 EXTEND 결정에만 Idempotency-Key를 보낸다', async () => {
  const operations = [
    [
      roomMutations.create({ dates: { from: '2026-11-20', through: '2026-11-21' }, capacity: 4 }),
      '/api/rooms',
      true,
    ],
    [roomMutations.calculateOptions(roomId, { inputVersion: 1 }), 'planning-options', true],
    [
      roomMutations.openRegistration(roomId, { selectionId: roomId, requiredCategories: ['FOOD'] }),
      'place-submission',
      true,
    ],
    [roomMutations.startVoting(roomId, { round: 1, closesAt: deadline }), 'voting', true],
    [roomMutations.recollect(roomId, { round: 1, closesAt: deadline }), 'recovery', true],
    [
      roomMutations.extendRegistration(roomId, { round: 1, mode: 'MINI_TIMER' }),
      'place-submission/extension',
      true,
    ],
    [
      roomMutations.extendRegistration(roomId, { round: 1, mode: 'EXTEND', closesAt: deadline }),
      'place-submission/extension',
      true,
    ],
    [
      roomMutations.decideVote(roomId, { round: 1, action: 'EXTEND', closesAt: deadline }),
      'voting/decision',
      true,
    ],
    [roomMutations.decideVote(roomId, { round: 1, action: 'PROCEED' }), 'voting/decision', false],
    [roomMutations.closeRegistration(roomId, { round: 1 }), 'place-submission/closure', false],
  ];
  const keys = new Set();
  for (const [operation, suffix, needsKey] of operations) {
    await operation.execute();
    const { path, options } = requests.at(-1);
    assert.equal(path, suffix === '/api/rooms' ? suffix : `/api/rooms/${roomId}/${suffix}`);
    const key = options.headers['Idempotency-Key'];
    assert.equal(Boolean(key), needsKey);
    if (key) keys.add(key);
  }
  assert.equal(keys.size, 8);
});

test('카테고리, 역할과 선호도는 wire 값과 UI 값 사이를 왕복한다', () => {
  for (const [ui, wire] of Object.entries(toApiCategory)) assert.equal(toUiCategory[wire], ui);
  for (const [ui, wire] of Object.entries(toApiRole)) assert.equal(toUiRole[wire], ui);
  for (const [ui, wire] of Object.entries(toApiVote)) assert.equal(toUiVote[wire], ui);
  assert.equal(toApiCategory.pub, 'BAR');
  assert.equal(toApiRole.PARTICIPANT, 'MEMBER');
  assert.equal(toApiVote.neutral, 'NEUTRAL');
});

test('new room operations preserve methods, round query, and CSRF', async () => {
  const round = 2;
  const start = { expectedRevision: 3 };
  const update = { ...start, dates: { from: '2026-11-20', through: '2026-11-21' } };
  const confirm = { round, resultRevision: 4 };
  const candidate = { round, category: 'FOOD', pickToken: 'test-token' };
  const operations = [
    [roomMutations.start(roomId, start), 'POST', '/start', start],
    [roomMutations.updateSettings(roomId, update), 'PUT', '/settings', update],
    [roomMutations.confirmResult(roomId, confirm), 'PUT', '/result/confirmation', confirm],
    [
      roomMutations.addCandidate(roomId, candidate),
      'POST',
      '/place-submission/me/candidates',
      candidate,
    ],
    [
      roomMutations.removeCandidate(roomId, roomId, round),
      'DELETE',
      '/place-submission/me/candidates/' + roomId,
    ],
    [roomMutations.hidePastRoom(roomId), 'DELETE', ''],
  ];
  assert.throws(
    () => roomMutations.removeCandidate(roomId, '../completion', round),
    /candidate UUID/,
  );
  for (const [mutation, method, suffix, body] of operations) {
    const response = await mutation.execute();
    const { path, query, options } = requests.at(-1);
    assert.equal(path, '/api/rooms/' + roomId + suffix);
    assert.equal(options.method, method);
    assert.equal(options.body, JSON.stringify(body));
    assert.equal(options.headers['X-CSRF-TOKEN'], 'test-csrf');
    assert.equal(options.credentials, 'include');
    assert.equal(Boolean(options.headers['Idempotency-Key']), suffix === '/settings');
    assert.deepEqual(query, method === 'DELETE' && suffix ? { round: '2' } : {});
    assert.deepEqual(response, body === candidate ? { candidateId: roomId } : undefined);
  }
});

test('share purpose and OAuth return parameters are encoded as query values', async () => {
  const signal = new AbortController().signal;
  assert.deepEqual(await getRoomShare(roomId, 'RESULT', signal), {
    purpose: 'RESULT',
    recipients: [],
  });
  assert.deepEqual(requests.at(-1).query, { purpose: 'RESULT' });
  assert.equal(requests.at(-1).options.signal, signal);
  const returnTo = '/rooms/' + roomId;
  const returnOrigin = 'http://localhost:5173';
  const url = getKakaoStartUrl({ returnTo, returnOrigin });
  assert.equal(url.pathname, '/api/auth/kakao/start');
  assert.deepEqual(Object.fromEntries(url.searchParams), { returnTo, returnOrigin });
  assert.equal(getKakaoStartUrl({ inviteToken: 'token' }).searchParams.get('inviteToken'), 'token');
});

test('detailed contract empty 204 responses work with existing room mutation handles', async () => {
  detailResponse = true;
  try {
    const { allowedActions, registration } = await getRoomState(roomId);
    assert.ok(allowedActions.includes('EDIT_NOMINATION'));
    assert.deepEqual(registration.myCandidates, [registeredCandidate]);
    const [{ candidateId }] = registration.myCandidates;
    await roomMutations.removeCandidate(roomId, candidateId, registration.round).execute();
    assert.equal(
      requests.at(-1).path,
      `/api/rooms/${roomId}/place-submission/me/candidates/${candidateId}`,
    );
    assert.deepEqual(requests.at(-1).query, { round: '2' });
    const operations = [
      roomMutations.start(roomId, { expectedRevision: 3 }),
      roomMutations.updateSettings(roomId, {
        title: null,
        dates: { from: '2026-11-20', through: '2026-11-21' },
        capacity: 4,
        expectedRevision: 4,
      }),
      roomMutations.hidePastRoom(roomId),
      roomMutations.confirmResult(roomId, { round: 2, resultRevision: 4 }),
    ];
    for (const operation of operations) assert.equal(await operation.execute(), undefined);
  } finally {
    detailResponse = false;
  }
});
