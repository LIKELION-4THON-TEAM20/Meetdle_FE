import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const roomId = '01234567-89ab-4cde-8f01-23456789abcd';
const station = {
  stationId: 'station-wire',
  name: '왕십리역',
  lines: ['2호선', '수인분당선'],
  lat: 37,
  lng: 127,
};
const slot = {
  slotId: 'slot-wire',
  meetingAt: '2026-11-20T14:00:00Z',
  endsAt: '2026-11-20T15:00:00Z',
  availableCount: 2,
  unavailableParticipantIds: ['p3'],
};
const region = {
  candidateId: 'candidate-wire',
  station,
  meanMinutes: 21.5,
  maxMinutes: 38,
  meanTransfers: 0.5,
  reasons: ['LOW_TRANSFER'],
  travel: [{ participantId: 'p1', minutes: 17, transfers: 1 }],
  score: { timeSpreadMinutes: 8, meanTotalTransfers: 1 },
};
const options = {
  optionsId: 'options-wire',
  inputVersion: 7,
  matrixVersion: 'matrix-wire',
  slots: [slot],
  regions: [region],
};
const base = {
  roomId,
  revision: 12,
  inputVersion: 9,
  me: { participantId: 'p1', role: 'HOST' },
  members: [
    { participantId: 'p1', nickname: '세진' },
    { participantId: 'p3', nickname: '민지' },
  ],
  inputProgress: { completedCount: 5, capacity: 6 },
  options,
  meeting: null,
  allowedActions: ['CALCULATE_OPTIONS', 'SELECT_MEETING'],
};
const meeting = {
  selectionId: 'selection-wire',
  station,
  meetingAt: slot.meetingAt,
  endsAt: slot.endsAt,
};
let fresh = structuredClone(base);
let failPost = false;
let failGet = false;
let failPut = false;
let writes = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (url.pathname === '/api/me')
    return Response.json({ user: { userId: 'user', nickname: '세진' }, csrfToken: 'csrf-test' });
  if (url.pathname.endsWith('/state')) {
    if (failGet) throw new Error('lost read');
    return Response.json(fresh);
  }
  writes.push({ path: url.pathname, ...init });
  if (url.pathname.endsWith('/planning-options')) {
    if (failPost) throw new Error('lost response');
    return Response.json(options, { status: 201 });
  }
  fresh = { ...base, meeting };
  if (failPut) throw new Error('lost PUT response');
  return Response.json(meeting);
};
const vite = await createServer({
  envDir: false,
  define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('https://example.test') },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
});
const { planningCandidates, meetingSelection, seoulDateTime } = await vite.ssrLoadModule(
  '/src/features/planning/model.ts',
);
const { calculationOperation, selectionOperation } = await vite.ssrLoadModule(
  '/src/features/planning/operations.ts',
);
after(async () => {
  globalThis.fetch = originalFetch;
  await vite.close();
});

test('서버 후보 IDs·서울 날짜·스냅샷 인원·이동정보를 보존하고 대기시간을 만들지 않는다', () => {
  const data = planningCandidates(base);
  assert.equal(data.timeCandidates[0].id, slot.slotId);
  assert.equal(data.timeCandidates[0].date, '2026-11-20');
  assert.equal(data.timeCandidates[0].endTime, '2026-11-21 00:00');
  assert.equal(data.timeCandidates[0].totalCount, 3);
  assert.deepEqual(data.timeCandidates[0].unavailableParticipantNames, ['민지']);
  assert.equal(data.timeCandidates[0].averageWaitMinutes, undefined);
  assert.equal(data.regionCandidates[0].lineLabel, '2호선·수인분당선');
  assert.deepEqual(data.regionCandidates[0].participantTravels[0], {
    participantId: 'p1',
    name: '세진',
    minutes: 17,
    transfers: 1,
  });
  assert.equal(data.regionCandidates[0].averageTravelMinutes, 21.5);
  assert.deepEqual(seoulDateTime(slot.endsAt), { date: '2026-11-21', time: '00:00' });
  assert.deepEqual(planningCandidates({ ...base, options: null }), {
    timeCandidates: [],
    regionCandidates: [],
  });
});

test('선택 요청은 서버 옵션 IDs와 현재 selectionId만 사용하며 외부 후보·MEMBER를 거절한다', () => {
  const request = { timeCandidateId: slot.slotId, regionCandidateId: region.candidateId };
  assert.deepEqual(meetingSelection(base, request), {
    optionsId: options.optionsId,
    slotId: slot.slotId,
    candidateId: region.candidateId,
    expectedSelectionId: null,
  });
  assert.equal(
    meetingSelection({ ...base, meeting }, request).expectedSelectionId,
    meeting.selectionId,
  );
  assert.throws(() => meetingSelection({ ...base, me: { role: 'MEMBER' } }, request));
  assert.throws(() => meetingSelection({ ...base, allowedActions: [] }, request));
  assert.throws(() => meetingSelection(base, { ...request, timeCandidateId: 'mock-time' }));
});

test('계산 중복 실행은 하나로 합치며 네트워크 재시도에 동일 Idempotency-Key와 inputVersion을 사용한다', async () => {
  writes = [];
  fresh = base;
  failPost = true;
  const op = calculationOperation(base);
  const first = op.execute();
  assert.equal(first, op.execute());
  await assert.rejects(first);
  failPost = false;
  const result = await op.execute();
  assert.equal(result.options.optionsId, options.optionsId);
  assert.equal(writes.length, 2);
  assert.equal(writes[0].headers['Idempotency-Key'], writes[1].headers['Idempotency-Key']);
  assert.deepEqual(JSON.parse(writes[0].body), { inputVersion: 9 });
  assert.equal(writes[0].headers['X-CSRF-TOKEN'], 'csrf-test');
});

test('POST 성공 뒤 상태 조회만 실패하면 재시도는 POST를 반복하지 않는다', async () => {
  writes = [];
  fresh = base;
  failGet = true;
  const op = calculationOperation(base);
  await assert.rejects(op.execute());
  failGet = false;
  await op.execute();
  assert.equal(writes.length, 1);
});

test('PUT 성공 뒤 조회 실패는 조회만 재시도하고 실제 meeting을 반환한다', async () => {
  writes = [];
  fresh = base;
  failGet = true;
  const body = meetingSelection(base, {
    timeCandidateId: slot.slotId,
    regionCandidateId: region.candidateId,
  });
  const op = selectionOperation(base, body);
  await assert.rejects(op.execute());
  failGet = false;
  assert.deepEqual((await op.execute()).meeting, meeting);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].headers['Idempotency-Key'], undefined);
  assert.deepEqual(JSON.parse(writes[0].body), body);
});

test('응답을 잃은 PUT은 GET으로 실제 결과를 확인하고 다시 전송하지 않는다', async () => {
  writes = [];
  fresh = base;
  failPut = true;
  const op = selectionOperation(
    base,
    meetingSelection(base, { timeCandidateId: slot.slotId, regionCandidateId: region.candidateId }),
  );
  await assert.rejects(op.execute());
  failPut = false;
  assert.equal((await op.execute()).meeting.selectionId, meeting.selectionId);
  assert.equal(writes.length, 1);
});

test('확정 조회 결과가 다른 후보면 로컬 성공을 만들지 않는다', async () => {
  writes = [];
  fresh = base;
  failGet = true;
  const op = selectionOperation(
    base,
    meetingSelection(base, { timeCandidateId: slot.slotId, regionCandidateId: region.candidateId }),
  );
  await assert.rejects(op.execute());
  failGet = false;
  fresh = {
    ...base,
    meeting: { ...meeting, station: { ...station, stationId: 'another-station' } },
  };
  await assert.rejects(op.execute(), /확정 상태/);
  assert.equal(writes.length, 1);
});

test('성공을 확인한 PUT도 다른 selectionId로 바뀌면 이동하지 않는다', async () => {
  writes = [];
  fresh = base;
  failGet = true;
  const op = selectionOperation(
    base,
    meetingSelection(base, { timeCandidateId: slot.slotId, regionCandidateId: region.candidateId }),
  );
  await assert.rejects(op.execute());
  failGet = false;
  fresh = { ...base, meeting: { ...meeting, selectionId: 'concurrent-selection' } };
  await assert.rejects(op.execute(), /확정 상태/);
  assert.equal(writes.length, 1);
});

test('재선택 요청은 기존 selectionId를 기대값으로 전달하며 동시 PUT을 합친다', async () => {
  writes = [];
  fresh = { ...base, meeting: { ...meeting, selectionId: 'previous-selection' } };
  const body = meetingSelection(fresh, {
    timeCandidateId: slot.slotId,
    regionCandidateId: region.candidateId,
  });
  const op = selectionOperation(fresh, body);
  const first = op.execute();
  assert.equal(first, op.execute());
  assert.equal((await first).meeting.selectionId, meeting.selectionId);
  assert.equal(writes.length, 1);
  assert.equal(JSON.parse(writes[0].body).expectedSelectionId, 'previous-selection');
});
