import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';
const server = await createServer({
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
});
after(() => server.close());
const { candidateDates, toUiStation, restoreScheduleInput, toSaveInput } =
  await server.ssrLoadModule('/src/pages/ScheduleTransit/api/model.ts');
const { createScheduleSaver, ScheduleConflictError } = await server.ssrLoadModule(
  '/src/pages/ScheduleTransit/api/saveSchedule.ts',
);
const { ApiRequestError } = await server.ssrLoadModule('/src/api/client.ts');
const { isSupportedStation, prepareScheduleInput } = await server.ssrLoadModule(
  '/src/pages/ScheduleTransit/scheduleUtils.ts',
);
const id = '12345678-1234-4234-8234-123456789abc';
const stationId = '22345678-1234-4234-8234-123456789abc';
const destinationId = '32345678-1234-4234-8234-123456789abc';
const station = { stationId, name: '노원역', lines: ['4', '7'], lat: 37.65, lng: 127.06 };
const destination = {
  ...station,
  stationId: destinationId,
  name: '상봉역',
  lines: ['경춘선', '경의중앙선', '7호선'],
};
const myInput = {
  originStation: station,
  destinationStation: destination,
  slots: [{ date: '2028-02-29', hour: 23 }],
  inputRevision: 7,
  completedAt: null,
};
const state = {
  roomId: id,
  dates: { from: '2028-02-28', through: '2028-03-01' },
  myInput,
  allowedActions: ['EDIT_INPUT', 'COMPLETE_INPUT'],
  me: { participantId: 'me', role: 'MEMBER' },
};
const input = {
  roomId: id,
  availability: [{ date: '2028-02-29', slotId: '23:00' }],
  departureStationId: stationId,
  destinationStationId: destinationId,
};
const owner = { user: { userId: 'user-a', nickname: '가' }, csrfToken: 'csrf-a' };
const completed = { ...myInput, inputRevision: 8, completedAt: '2028-02-01T10:00:00Z' };
const savedState = { ...state, myInput: completed, allowedActions: [] };
const failure = (code, status = 409) => new ApiRequestError(status, { code, message: code });
const deps = (overrides = {}) => ({
  getSession: async () => owner,
  getState: async () => savedState,
  save: () => ({ execute: async () => completed }),
  ...overrides,
});

test('후보 기간 양끝·윤일을 포함하며 잘못된 날짜·역전·8일 기간은 조용히 보정하지 않는다', () => {
  assert.deepEqual(candidateDates(state.dates), ['2028-02-28', '2028-02-29', '2028-03-01']);
  for (const dates of [
    { from: '2026-02-30', through: '2026-03-01' },
    { from: '2028-03-01', through: '2028-02-29' },
    { from: '2028-03-01', through: '2028-03-08' },
  ])
    assert.throws(() => candidateDates(dates), { code: 'INVALID_RESPONSE' });
});

test('역 UUID와 실제 노선을 보존하고 숫자/호선 문자열 및 환승역을 UI 타입에 매핑한다', () => {
  const ui = toUiStation(destination);
  assert.equal(ui.id, destinationId);
  assert.deepEqual(ui.lines, [
    { id: '경춘선', name: '경춘선' },
    { id: '경의중앙선', name: '경의중앙선' },
    { id: '7', name: '7호선' },
  ]);
  assert.equal(isSupportedStation(ui), true);
  assert.equal(isSupportedStation(toUiStation({ ...station, lines: ['경춘선'] })), true);
  assert.equal(
    isSupportedStation({ id: 'mock', name: '목 역', lines: [{ id: '경춘선', name: '경춘선' }] }),
    false,
  );
  assert.throws(() => toUiStation({ ...station, stationId: 'nowon' }), {
    code: 'INVALID_RESPONSE',
  });
});

test('기존 슬롯·역을 복원하고 complete/inputRevision/hour를 손실 없이 제출한다', () => {
  const restored = restoreScheduleInput(candidateDates(state.dates), myInput);
  assert.deepEqual([...restored.selected], ['2028-02-29/23:00']);
  assert.equal(restored.departure.query, '노원');
  const uiInput = prepareScheduleInput(
    { id, candidateDates: candidateDates(state.dates) },
    restored.selected,
    restored.departure,
    restored.destination,
  );
  assert.deepEqual(toSaveInput(state, uiInput), {
    originStationId: stationId,
    destinationStationId: destinationId,
    slots: [{ date: '2028-02-29', hour: 23 }],
    inputRevision: 7,
    complete: true,
  });
  assert.equal(
    toSaveInput(state, { ...input, destinationStationId: stationId }).destinationStationId,
    stationId,
  );
  assert.throws(
    () =>
      restoreScheduleInput(candidateDates(state.dates), {
        ...myInput,
        slots: [{ date: '2028-02-29', hour: 9 }],
      }),
    { code: 'INVALID_RESPONSE' },
  );
  assert.throws(() => toSaveInput(state, { ...input, roomId: 'mock-room' }), {
    code: 'INVALID_RESPONSE',
  });
});

test('완료/잠긴 입력은 수정하지 않고 모르는 inputRevision을 0으로 만들지 않는다', () => {
  assert.throws(() => toSaveInput(savedState, input), { code: 'INPUT_LOCKED' });
  assert.throws(() => toSaveInput({ ...state, allowedActions: [] }, input), {
    code: 'INPUT_LOCKED',
  });
  assert.throws(
    () => toSaveInput({ ...state, myInput: { ...myInput, inputRevision: undefined } }, input),
    { code: 'INVALID_RESPONSE' },
  );
});

test('중복 제출은 한 PUT을 공유하고 저장 성공 후 방 상태를 읽어야 완료한다', async () => {
  let writes = 0,
    reads = 0;
  const saver = createScheduleSaver(
    state,
    owner,
    deps({
      save: (_id, body) => {
        assert.equal(_id, id);
        assert.equal(body.inputRevision, 7);
        return {
          execute: async () => {
            writes++;
            return completed;
          },
        };
      },
      getState: async () => {
        reads++;
        return savedState;
      },
    }),
  );
  const first = saver.run(input);
  assert.equal(saver.run(input), first);
  assert.equal(await first, savedState);
  assert.equal(writes, 1);
  assert.equal(reads, 1);
});

test('PUT 성공 뒤 상태 조회 실패의 재시도는 PUT을 반복하지 않는다', async () => {
  let writes = 0,
    reads = 0;
  const saver = createScheduleSaver(
    state,
    owner,
    deps({
      save: () => ({
        execute: async () => {
          writes++;
          return completed;
        },
      }),
      getState: async () => {
        if (++reads === 1) throw failure('NETWORK_ERROR', null);
        return savedState;
      },
    }),
  );
  await assert.rejects(saver.run(input), { code: 'NETWORK_ERROR' });
  assert.equal(saver.freeze, true);
  assert.equal(await saver.run(input), savedState);
  assert.equal(writes, 1);
  assert.equal(reads, 2);
});

test('PUT 응답 유실 후 이미 저장된 상태를 확인하면 재전송하지 않는다', async () => {
  let writes = 0,
    reads = 0;
  const saver = createScheduleSaver(
    state,
    owner,
    deps({
      save: () => ({
        execute: async () => {
          writes++;
          throw failure('NETWORK_ERROR', null);
        },
      }),
      getState: async () => {
        reads++;
        return savedState;
      },
    }),
  );
  await assert.rejects(saver.run(input));
  assert.equal(await saver.run(input), savedState);
  assert.equal(writes, 1);
  assert.equal(reads, 1);
});

test('STALE_INPUT 및 충돌 재조회 실패 후에는 최신 버전으로 자동 덮어쓰지 않는다', async () => {
  let writes = 0,
    reads = 0;
  const newest = { ...state, myInput: { ...myInput, inputRevision: 9 } };
  const saver = createScheduleSaver(
    state,
    owner,
    deps({
      save: () => ({
        execute: async () => {
          writes++;
          throw failure('STALE_INPUT');
        },
      }),
      getState: async () => {
        if (++reads === 1) throw failure('NETWORK_ERROR', null);
        return newest;
      },
    }),
  );
  await assert.rejects(saver.run(input), { code: 'NETWORK_ERROR' });
  await assert.rejects(saver.run(input), ScheduleConflictError);
  assert.equal(writes, 1);
});

test('다른 사용자·CSRF로 저장을 시작하지 않으며, 상태의 방 ID 불일치를 거부한다', async () => {
  let writes = 0;
  const saver = createScheduleSaver(
    state,
    owner,
    deps({
      getSession: async () => ({ ...owner, csrfToken: 'other' }),
      save: () => ({
        execute: async () => {
          writes++;
          return completed;
        },
      }),
    }),
  );
  await assert.rejects(saver.run(input), { code: 'SESSION_CHANGED' });
  assert.equal(writes, 0);
  const wrong = createScheduleSaver(
    state,
    owner,
    deps({ getState: async () => ({ ...savedState, roomId: destinationId }) }),
  );
  await assert.rejects(wrong.run(input), { code: 'INVALID_RESPONSE' });
});

test('미입력 서버 값은 빈 선택으로 복원하되 서버의 최초 revision 0을 그대로 사용한다', () => {
  const empty = {
    originStation: null,
    destinationStation: null,
    slots: [],
    inputRevision: 0,
    completedAt: null,
  };
  const restored = restoreScheduleInput(candidateDates(state.dates), empty);
  assert.equal(restored.selected.size, 0);
  assert.deepEqual(restored.departure, { query: '', station: null });
  assert.deepEqual(restored.destination, { query: '', station: null });
  assert.equal(toSaveInput({ ...state, myInput: empty }, input).inputRevision, 0);
});

test('완료 표시나 새 버전이 없는 저장 응답은 성공으로 이동하지 않는다', async () => {
  for (const response of [
    { ...completed, completedAt: null },
    { ...completed, inputRevision: 7 },
  ]) {
    const saver = createScheduleSaver(
      state,
      owner,
      deps({ save: () => ({ execute: async () => response }) }),
    );
    await assert.rejects(saver.run(input), { code: 'INVALID_RESPONSE' });
  }
});
