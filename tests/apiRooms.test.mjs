import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const roomId = '01234567-89ab-4cde-8f01-23456789abcd';
const deadline = '2026-11-20T09:00:00Z';
const requests = [];
let stateRoomId = roomId;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  const path = url.pathname;
  requests.push({ path, options });
  if (path === '/api/me') {
    return Response.json({
      user: { userId: roomId, nickname: '테스트' },
      csrfToken: 'test-csrf',
    });
  }
  if (path.endsWith('/state')) return Response.json({ roomId: stateRoomId, revision: 3 });
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
const { getRoomState, roomMutations } = await server.ssrLoadModule('/src/api/rooms.ts');
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
