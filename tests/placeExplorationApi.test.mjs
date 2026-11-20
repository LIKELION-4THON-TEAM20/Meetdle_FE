import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';
const roomId = '01234567-89ab-4cde-8f01-23456789abcd';
const station = {
  stationId: 'station-wire',
  name: '왕십리역',
  lat: 37.561,
  lng: 127.037,
  lines: ['2호선'],
};
const place = {
  name: '서버 카페',
  address: '서울 성동구',
  lat: 37.562,
  lng: 127.038,
  category: 'CAFE',
  detailUrl: null,
};
const second = { ...place, name: '변경 카페', lng: 127.039 };
const categories = [
  { category: 'CAFE', required: true, available: true, radiusMeters: 2500 },
  { category: 'FOOD', required: true, available: true, radiusMeters: 2500 },
];
const base = {
  roomId,
  title: '테스트',
  revision: 1,
  phase: 'PLACE_SUBMISSION_OPEN',
  serverNow: '2026-11-19T00:00:00Z',
  me: { participantId: 'p1', role: 'MEMBER', canRegister: true },
  meeting: {
    selectionId: 'selection-wire',
    station,
    meetingAt: '2026-11-20T09:00:00Z',
    endsAt: '2026-11-20T10:00:00Z',
  },
  registration: {
    round: 3,
    closesAt: '2026-11-19T12:00:00Z',
    closedAt: null,
    progress: { completedCount: 1, capacity: 4 },
    completion: [{ participantId: 'p2', nickname: '민지', completed: true }],
    categories,
    uniqueCandidateCount: 8,
    myCompleted: false,
    myNominations: [],
    myCandidates: [],
    categoryCounts: null,
  },
  allowedActions: ['SEARCH_PLACES', 'EDIT_NOMINATION', 'COMPLETE_COLLECTION'],
};
const candidateId = '11234567-89ab-4cde-8f01-23456789abcd';
const secondId = '21234567-89ab-4cde-8f01-23456789abcd';
const now = Date.parse(base.serverNow);
function setCandidates(places) {
  state.registration.myNominations = places;
  state.registration.myCandidates = places.map((p) => ({
    candidateId: p.name === second.name ? secondId : candidateId,
    place: p,
  }));
}
let state, search, requests, failGet, failPut, putStatus;
let sessionUser = 'user';
let deleteStatus = 204;
function reset() {
  sessionUser = 'user';
  deleteStatus = 204;
  state = structuredClone(base);
  search = {
    items: [{ place, distanceMeters: 450, registrable: true, pickToken: 'wire-token' }],
    radiusMeters: 2500,
    nextPage: null,
    available: true,
    expanded: false,
  };
  requests = [];
  failGet = false;
  failPut = false;
  putStatus = 204;
}
reset();
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  requests.push({ path: url.pathname, query: Object.fromEntries(url.searchParams), ...init });
  if (url.pathname === '/api/me')
    return Response.json({
      user: { userId: sessionUser, nickname: '세진' },
      csrfToken: 'csrf-test',
    });
  if (url.pathname.endsWith('/state')) {
    if (failGet) throw new Error('GET failed');
    return Response.json(state);
  }
  if (url.pathname.endsWith('/places/search')) return Response.json(search);
  if (putStatus !== 204)
    return Response.json({ code: 'STALE_ROUND', message: 'stale' }, { status: putStatus });
  const body = init.body === undefined ? undefined : JSON.parse(init.body);
  const action = url.pathname.split('/').at(-1);
  state = { ...state, revision: state.revision + 1, registration: { ...state.registration } };
  let addedId;
  if (action === 'completion') state.registration.myCompleted = true;
  else if (init.method === 'POST') {
    const p = body.pickToken === 'second-token' ? second : place;
    addedId = p.name === second.name ? secondId : candidateId;
    if (!state.registration.myCandidates.some((c) => c.candidateId === addedId))
      state.registration.myCandidates = [
        ...state.registration.myCandidates,
        { candidateId: addedId, place: p },
      ];
  } else if (init.method === 'DELETE') {
    state.registration.myCandidates = state.registration.myCandidates.filter(
      (c) => c.candidateId !== action,
    );
  }
  state.registration.myNominations = state.registration.myCandidates.map((c) => c.place);
  if (failPut) throw new Error('Write response lost');
  return addedId
    ? Response.json({ candidateId: addedId })
    : new Response(null, { status: init.method === 'DELETE' ? deleteStatus : 204 });
};
const vite = await createServer({
  envDir: false,
  define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('https://example.test') },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
});
const {
  createApiExplorationRepository,
  displayPlace,
  placeKey,
  registrationEditable,
  canCompleteRegistration,
  registeredCandidates,
} = await vite.ssrLoadModule('/src/pages/PlaceExploration/apiRepository.ts');
const { api } = await vite.ssrLoadModule('/src/api/client.ts');
after(async () => {
  globalThis.fetch = originalFetch;
  await vite.close();
});
const writes = () => requests.filter((r) => ['PUT', 'POST', 'DELETE'].includes(r.method));
async function open() {
  const repo = createApiExplorationRepository(roomId);
  await repo.open();
  return repo;
}

test('표시 키는 payload가 아니며 없는 이미지·카카오 ID·URL·거리를 생성하지 않는다', () => {
  const saved = displayPlace(place);
  assert.equal(saved.kakaoPlaceId, null);
  assert.equal(saved.kakaoMapUrl, null);
  assert.equal(saved.imageUrl, undefined);
  assert.equal(saved.distanceMeters, undefined);
  assert.equal(
    displayPlace({ ...place, detailUrl: 'https://place.map.kakao.com/123' }).kakaoMapUrl,
    'https://place.map.kakao.com/123',
  );
  assert.equal(saved.coordinates.latitude, place.lat);
  assert.equal(saved.categoryId, 'cafe');
});
test('실제 UUID만 조회하며 회차·내 장소·완료 및 서버 좌표를 그대로 복원한다', async () => {
  reset();
  assert.throws(() => createApiExplorationRepository('exploration-preview'));
  setCandidates([place]);
  state.registration.myCompleted = true;
  const repo = await open();
  const restored = await repo.reload();
  assert.equal(restored.registration.round, 3);
  assert.equal(restored.registration.myCompleted, true);
  assert.deepEqual(restored.registration.myNominations, [place]);
  assert.deepEqual(restored.meeting.station, station);
  assert.equal(writes().length, 0);
});
test('검색 카테고리·trim한 검색어·페이지를 전달하며 범위와 등록 가능 판정을 유지한다', async () => {
  reset();
  const repo = await open();
  search = { ...search, radiusMeters: 3000, expanded: true, nextPage: 2, available: false };
  const response = await repo.search('CAFE', ' 디저트 ');
  assert.deepEqual(requests.at(-1).query, { category: 'CAFE', q: '디저트', page: '1' });
  assert.equal(response.radiusMeters, 3000);
  assert.equal(response.available, false);
  search.nextPage = null;
  await repo.search('CAFE', '디저트', 2);
  assert.equal(requests.at(-1).query.page, '2');
  await assert.rejects(repo.search('CAFE', 'x'.repeat(61)));
});
test('복수 후보 추가는 category·round·pickToken을 보내고 단건 삭제는 복원된 ID와 round만 보낸다', async () => {
  reset();
  const repo = await open();
  await repo.search('CAFE', '');
  let op = repo.nominate('CAFE', placeKey(place), now);
  const first = op.execute();
  assert.equal(first, op.execute());
  let fresh = await first;
  assert.deepEqual(JSON.parse(writes()[0].body), {
    round: 3,
    category: 'CAFE',
    pickToken: 'wire-token',
  });
  assert.equal(writes()[0].headers['X-CSRF-TOKEN'], 'csrf-test');
  assert.equal(writes()[0].headers['Idempotency-Key'], undefined);
  assert.equal(requests.at(-1).path, `/api/rooms/${roomId}/state`);
  assert.deepEqual(fresh.registration.myNominations, [place]);
  search.items = [
    { place: second, distanceMeters: 500, registrable: true, pickToken: 'second-token' },
  ];
  await repo.search('CAFE', '');
  fresh = await repo.nominate('CAFE', placeKey(second), now).execute();
  assert.deepEqual(fresh.registration.myNominations, [place, second]);
  fresh = await repo.withdraw(candidateId, now).execute();
  assert.equal(writes().at(-1).method, 'DELETE');
  assert.equal(
    writes().at(-1).path,
    `/api/rooms/${roomId}/place-submission/me/candidates/${candidateId}`,
  );
  assert.deepEqual(writes().at(-1).query, { round: '3' });
  assert.equal(writes().at(-1).body, undefined);
  assert.deepEqual(
    fresh.registration.myCandidates.map((c) => c.candidateId),
    [secondId],
  );
});
test('검색 증표가 없거나 등록 불가·카테고리 불일치인 결과는 PUT하지 않는다', async () => {
  reset();
  const repo = await open();
  assert.throws(() => repo.nominate('CAFE', 'mock-place-id', now));
  search.items = [{ place, distanceMeters: 450, registrable: false, pickToken: null }];
  await repo.search('CAFE', '');
  assert.throws(() => repo.nominate('CAFE', placeKey(place), now));
  search.items = [{ place, distanceMeters: 450, registrable: true, pickToken: 'wire-token' }];
  await repo.search('CAFE', '');
  assert.throws(() => repo.nominate('FOOD', placeKey(place), now));
  assert.equal(writes().length, 0);
});
test('본인 완료·회차 마감·액션·자격을 서버 값으로 제한한다', async () => {
  for (const change of [
    (s) => (s.registration.myCompleted = true),
    (s) => (s.registration.closedAt = s.serverNow),
    (s) => (s.allowedActions = []),
    (s) => (s.me.canRegister = false),
    (s) => (s.phase = 'VOTING_OPEN'),
  ]) {
    reset();
    change(state);
    const repo = await open();
    if (state.allowedActions.includes('SEARCH_PLACES')) await repo.search('CAFE', '');
    assert.throws(() => repo.nominate('CAFE', placeKey(place), now));
    assert.equal(writes().length, 0);
  }
  assert.equal(registrationEditable(base, Date.parse(base.registration.closesAt)), false);
});
test('필수 카테고리가 남아 있어도 본인 후보 한 곳이면 완료하고 빈 목록은 차단한다', async () => {
  reset();
  const repo = await open();
  assert.equal(canCompleteRegistration(state), false);
  assert.throws(() => repo.complete(now));
  setCandidates([place]);
  await repo.reload();
  assert.equal(canCompleteRegistration(state), true);
  const fresh = await repo.complete(now).execute();
  assert.deepEqual(JSON.parse(writes()[0].body), { round: 3 });
  assert.ok(writes()[0].path.endsWith('/completion'));
  assert.equal(fresh.registration.myCompleted, true);
});
test('성공 PUT 뒤 GET 실패는 재전송 없이 조회만 재시도한다', async () => {
  reset();
  const repo = await open();
  await repo.search('CAFE', '');
  const op = repo.nominate('CAFE', placeKey(place), now);
  failGet = true;
  await assert.rejects(op.execute());
  failGet = false;
  await op.execute();
  assert.equal(writes().length, 1);
});
test('응답을 잃은 PUT은 서버에 저장된 본인 장소를 GET으로 확인한다', async () => {
  reset();
  const repo = await open();
  await repo.search('CAFE', '');
  const op = repo.nominate('CAFE', placeKey(place), now);
  failPut = true;
  await assert.rejects(op.execute());
  failPut = false;
  assert.deepEqual((await op.execute()).registration.myNominations, [place]);
  assert.equal(writes().length, 1);
});
test('다른 회차·불일치 결과와 명시적 409 거절은 성공으로 대체하지 않는다', async () => {
  reset();
  const repo = await open();
  await repo.search('CAFE', '');
  const op = repo.nominate('CAFE', placeKey(place), now);
  putStatus = 409;
  await assert.rejects(op.execute());
  setCandidates([place]);
  await assert.rejects(op.execute());
  assert.equal(writes().length, 1);
  await repo.open();
  putStatus = 204;
  await repo.search('CAFE', '');
  const secondOp = repo.nominate('CAFE', placeKey(place), now);
  failGet = true;
  await assert.rejects(secondOp.execute());
  failGet = false;
  state.registration.round = 4;
  await assert.rejects(secondOp.execute(), /등록 상태/);
  assert.equal(writes().length, 2);
});
test('새 검색과 상태 재조회는 이전 검색의 증표를 폐기한다', async () => {
  reset();
  const repo = await open();
  await repo.search('CAFE', '');
  search.items = [];
  await repo.search('CAFE', '없는장소');
  assert.throws(() => repo.nominate('CAFE', placeKey(place), now));
  search.items = [{ place, distanceMeters: 450, registrable: true, pickToken: 'wire-token' }];
  await repo.search('CAFE', '');
  await repo.reload();
  assert.throws(() => repo.nominate('CAFE', placeKey(place), now));
  assert.equal(writes().length, 0);
});

test('검색 available=false면 개별 결과에 증표가 있어도 등록하지 않는다', async () => {
  reset();
  const repo = await open();
  search.available = false;
  await repo.search('CAFE', '');
  assert.throws(() => repo.nominate('CAFE', placeKey(place), now));
  assert.equal(writes().length, 0);
});

test('새 repository는 A08의 candidateId를 복원해 한 곳만 삭제한다', async () => {
  reset();
  setCandidates([place, second]);
  const repo = await open();
  const loaded = await repo.reload();
  assert.equal(registeredCandidates(loaded)[0].candidateId, candidateId);
  const fresh = await repo.withdraw(candidateId, now).execute();
  assert.deepEqual(
    fresh.registration.myCandidates.map((c) => c.candidateId),
    [secondId],
  );
  assert.equal(writes().length, 1);
  assert.throws(() => repo.withdraw('mock-id', now));
});

test('candidateId 누락을 목 ID나 장소 키로 대체하지 않는다', async () => {
  reset();
  delete state.registration.myCandidates;
  await assert.rejects(open(), /myCandidates/);
  assert.equal(writes().length, 0);
});

test('서버에서 제공한 이미지만 사용하고 3페이지 밖 요청은 차단한다', async () => {
  reset();
  const repo = await open();
  assert.equal(
    displayPlace({ ...place, imageUrl: 'https://example.test/photo.jpg' }).imageUrl,
    'https://example.test/photo.jpg',
  );
  await assert.rejects(repo.search('CAFE', '', 4));
});

test('A35의 빈 200도 처리하고 다른 본인 후보는 보존한다', async () => {
  reset();
  setCandidates([place, second]);
  deleteStatus = 200;
  const repo = await open();
  const fresh = await repo.withdraw(candidateId, now).execute();
  assert.deepEqual(
    fresh.registration.myCandidates.map((c) => c.candidateId),
    [secondId],
  );
  assert.equal(writes().length, 1);
});

test('후보 추가 503 뒤 반영된 결과는 GET으로 복원하고 POST를 반복하지 않는다', async () => {
  reset();
  const repo = await open();
  await repo.search('CAFE', '');
  const op = repo.nominate('CAFE', placeKey(place), now);
  putStatus = 503;
  await assert.rejects(op.execute());
  putStatus = 204;
  setCandidates([place]);
  assert.equal((await op.execute()).registration.myCandidates[0].candidateId, candidateId);
  assert.equal(writes().length, 1);
});

test('가입 사용자 변경 뒤 이전 검색 증표로 쓰기를 실행하지 않는다', async () => {
  reset();
  const repo = await open();
  await repo.search('CAFE', '');
  const op = repo.nominate('CAFE', placeKey(place), now);
  sessionUser = 'another-user';
  await api.getSession({ refresh: true });
  await assert.rejects(op.execute(), (error) => error.code === 'SESSION_CHANGED');
  assert.equal(writes().length, 0);
});
