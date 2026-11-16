import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
});
after(() => server.close());
const { PATHS, roomPath, safeReturnTo, getRoomBackPath } =
  await server.ssrLoadModule('/src/router/paths.ts');
const { getMockRoomEntryPath } = await server.ssrLoadModule('/src/router/roomEntryPath.ts');
const { createMockRoom, reduceRoom } = await server.ssrLoadModule(
  '/src/features/mockRoom/model.ts',
);
const { CREATED_ROOM_STORAGE_KEY, createRoomPreview, getCreatedRoom, findCreatedRoomByCode } =
  await server.ssrLoadModule('/src/features/createdRoom/model.ts');
const storage = new Map();
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  },
});
after(() => {
  delete globalThis.sessionStorage;
});

test('홈에서 연 약속은 홈으로 돌아가며 다음 단계에 홈 진입 표식을 전파하지 않는다', () => {
  for (const fallback of [PATHS.create, PATHS.closeRegistration, PATHS.info, PATHS.voteStatus]) {
    assert.equal(getRoomBackPath(fallback, '?from=home&roomId=mock-room-10-14'), PATHS.home);
    assert.equal(getRoomBackPath(fallback, '?roomId=mock-room-10-14'), fallback);
  }
  const next = roomPath(PATHS.closeRegistration, '?from=home&roomId=mock-room-10-14&role=host');
  assert.equal(new URL(next, 'https://meetdle.invalid').searchParams.has('from'), false);
  assert.equal(
    getRoomBackPath(PATHS.registration, new URL(next, 'https://meetdle.invalid').search),
    PATHS.registration,
  );
});

test('이동은 방 ID·역할만 유지하고 일회성 reset·시나리오는 전파하지 않는다', () => {
  assert.equal(
    roomPath(
      PATHS.vote,
      '?roomId=mock-room-10-14&role=participant&mock=reset&scenario=tie&clock=fixed',
    ),
    '/rooms/vote?roomId=mock-room-10-14&role=participant',
  );
  assert.equal(
    roomPath(`${PATHS.startVote}?scenario=missingOptional`, '?roomId=room-a&role=host'),
    '/rooms/vote/start?scenario=missingOptional&roomId=room-a&role=host',
  );
  assert.equal(roomPath(PATHS.created, '', 'room-b'), '/rooms/create/complete?roomId=room-b');
  assert.equal(
    roomPath(`${PATHS.info}?roomId=room-b`, '?roomId=room-a'),
    '/rooms/info?roomId=room-b',
  );
  assert.equal(roomPath(PATHS.home, '?roomId=room-a&role=participant'), '/');
});

test('로그인 복귀 주소는 기존 내부 화면만 허용하고 초대 식별 정보를 보존한다', () => {
  assert.equal(
    safeReturnTo('/rooms/invite?roomId=mock-created-a&code=ABC123'),
    '/rooms/invite?roomId=mock-created-a&code=ABC123',
  );
  for (const value of [
    null,
    '//evil.example',
    'https://evil.example',
    '/\\evil.example',
    '/login?returnTo=/login',
    '/missing',
    '/rooms/invite\r\n',
  ])
    assert.equal(safeReturnTo(value), '/');
});

test('방별 생성 입력과 초대 코드는 분리되어 저장되며 다른 방으로 대체하지 않는다', () => {
  const creation = {
    name: 'A 모임',
    capacity: 4,
    dateRange: { start: '2026-12-10', end: '2026-12-12' },
  };
  const first = createRoomPreview(creation);
  const second = createRoomPreview({ ...creation, name: 'B 모임', capacity: 6 });
  assert.notEqual(first.id, second.id);
  assert.notEqual(first.inviteCode, second.inviteCode);
  assert.deepEqual(getCreatedRoom(first.id).creation, creation);
  assert.equal(getCreatedRoom(second.id).creation.name, 'B 모임');
  assert.equal(findCreatedRoomByCode(first.inviteCode).id, first.id);
  assert.equal(getCreatedRoom('unknown-room'), undefined);
  assert.equal(findCreatedRoomByCode('??????'), undefined);
  assert.equal(JSON.parse(storage.get(CREATED_ROOM_STORAGE_KEY)).length, 2);
});

test('새로고침용 저장 데이터는 검증하고 손상된 레코드는 복원하지 않는다', () => {
  const restored = {
    id: 'mock-created-restored',
    inviteCode: 'REST01',
    creation: { name: '복원된 입력', capacity: 3, dateRange: { start: '2026-12-01', end: null } },
  };
  storage.set(
    CREATED_ROOM_STORAGE_KEY,
    JSON.stringify([
      restored,
      { ...restored, id: 'mock-created-bad', creation: { ...restored.creation, capacity: -1 } },
    ]),
  );
  assert.equal(getCreatedRoom(restored.id).creation.name, '복원된 입력');
  assert.equal(getCreatedRoom('mock-created-bad'), undefined);
  storage.set(CREATED_ROOM_STORAGE_KEY, 'broken json');
  assert.equal(getCreatedRoom('mock-created-unknown'), undefined);
});

test('홈의 목적지는 기존 목 단계와 현재 사용자의 제출 상태에서 결정한다', () => {
  const now = Date.now();
  let room = createMockRoom(now);
  assert.equal(getMockRoomEntryPath(room), PATHS.registration);
  room = reduceRoom(room, { type: 'closeRegistration' });
  assert.equal(getMockRoomEntryPath(room), PATHS.startVote);
  assert.equal(
    getMockRoomEntryPath({ ...room, role: 'participant', currentUserId: 'haneul' }),
    PATHS.registration,
  );
  room = reduceRoom(room, { type: 'start', now, deadline: now + 3600000 });
  assert.equal(getMockRoomEntryPath(room), PATHS.vote);
  room = {
    ...room,
    participants: room.participants.map((person) =>
      person.id === room.currentUserId
        ? { ...person, vote: { ...person.vote, submitted: true } }
        : person,
    ),
  };
  assert.equal(getMockRoomEntryPath(room), PATHS.voteStatus);
  assert.equal(getMockRoomEntryPath({ ...room, phase: 'counting' }), PATHS.voteStatus);
  assert.equal(
    getMockRoomEntryPath({
      ...room,
      result: { categories: [], order: [], unresolvedTie: false, revotesUsed: 0 },
    }),
    PATHS.result,
  );
});
