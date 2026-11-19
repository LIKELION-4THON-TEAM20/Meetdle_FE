import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
});
after(() => server.close());
const {
  cellKey,
  changeStationQuery,
  formatCandidateDate,
  isSupportedStation,
  paintAvailability,
  prepareScheduleInput,
  searchStations,
} = await server.ssrLoadModule('/src/pages/ScheduleTransit/scheduleUtils.ts');
const { room, stations } = JSON.parse(
  readFileSync(new URL('./fixtures/schedule.json', import.meta.url), 'utf8'),
);
const { TIME_SLOT_GROUPS, TIME_SLOTS } = await server.ssrLoadModule(
  '/src/pages/ScheduleTransit/timeSlots.ts',
);
const [nowon, sangbong, gimyujeong] = stations;
const selectedStation = (station) => ({ query: station.name, station });
const emptyStation = { query: '', station: null };
const key = cellKey(room.candidateDates[0], '10:00');

test('design time bands cover every one-hour slot from 10 to 24 and weekdays derive from dates', () => {
  assert.deepEqual(
    TIME_SLOT_GROUPS.map((group) => group.label),
    ['점심 10~14', '오후 14~18', '저녁 18~22', '늦은 밤 22시 이후'],
  );
  assert.equal(TIME_SLOTS.length, 14);
  assert.deepEqual(
    TIME_SLOTS.map((slot) => [slot.startHour, slot.endHour]),
    Array.from({ length: 14 }, (_, i) => [10 + i, 11 + i]),
  );
  assert.deepEqual(formatCandidateDate('2026-11-14'), { dateLabel: '11/14', weekday: '토' });
  assert.deepEqual(formatCandidateDate('2028-02-29'), { dateLabel: '2/29', weekday: '화' });
});

test('a supported line is sufficient for transfer stations, unsupported stations stay searchable', () => {
  assert.equal(isSupportedStation(nowon), true);
  assert.equal(isSupportedStation(sangbong), true);
  assert.equal(isSupportedStation(gimyujeong), false);
  assert.equal(
    isSupportedStation({ id: 'edge', name: '테스트역', lines: [{ id: '10', name: '기타 노선' }] }),
    false,
  );
  assert.equal(isSupportedStation({ id: 'empty', name: '테스트역', lines: [] }), false);
  assert.deepEqual(
    searchStations(stations, ' 김유정역 ').map((station) => station.id),
    [gimyujeong.id],
  );
  assert.deepEqual(
    searchStations(stations, '상 봉').map((station) => station.id),
    [sangbong.id],
  );
  assert.deepEqual(searchStations(stations, ''), []);
  assert.deepEqual(searchStations(stations, '없는역'), []);
});

test('changing a query revokes selection; typing a matching station name alone does not select it', () => {
  assert.equal(changeStationQuery(selectedStation(nowon), '상봉').station, null);
  assert.equal(changeStationQuery(selectedStation(nowon), '').station, null);
  assert.equal(changeStationQuery(selectedStation(nowon), '노원').station, nowon);
  assert.equal(changeStationQuery(emptyStation, '노원').station, null);
});

test('painting is idempotent and never mutates the previous selection', () => {
  const original = new Set();
  const another = cellKey(room.candidateDates[1], '11:00');
  const painted = paintAvailability(original, [key, key, another], true);
  assert.equal(original.size, 0);
  assert.equal(painted.size, 2);
  assert.deepEqual(paintAvailability(painted, [key, another, key], true), painted);
  assert.equal(paintAvailability(painted, [key, key, another], false).size, 0);
  assert.equal(painted.size, 2);
});

test('all three requirements are mandatory, with selection distinct from search text', () => {
  const selected = new Set([key]);
  assert.equal(
    prepareScheduleInput(room, new Set(), selectedStation(nowon), selectedStation(sangbong)),
    null,
  );
  assert.equal(prepareScheduleInput(room, selected, emptyStation, selectedStation(sangbong)), null);
  assert.equal(prepareScheduleInput(room, selected, selectedStation(nowon), emptyStation), null);
  assert.equal(
    prepareScheduleInput(
      room,
      selected,
      { query: '노원', station: null },
      selectedStation(sangbong),
    ),
    null,
  );
  assert.equal(
    prepareScheduleInput(room, selected, selectedStation(nowon), { query: '상봉', station: null }),
    null,
  );
  assert.equal(
    prepareScheduleInput(room, selected, selectedStation(gimyujeong), selectedStation(sangbong)),
    null,
  );
  assert.equal(
    prepareScheduleInput(room, selected, selectedStation(nowon), selectedStation(gimyujeong)),
    null,
  );
  assert.equal(
    prepareScheduleInput(
      room,
      selected,
      { query: '다른역', station: nowon },
      selectedStation(sangbong),
    ),
    null,
  );
});

test('payload contains date/slot identities and station IDs; equal stations and arbitrary candidate dates work', () => {
  const otherRoom = { id: 'actual-room', candidateDates: ['2028-02-29', '2028-03-01'] };
  const selection = new Set([
    cellKey('2028-03-01', '23:00'),
    cellKey('2028-02-29', '10:00'),
    key,
    '2028-02-29/09:00',
  ]);
  assert.deepEqual(
    prepareScheduleInput(
      otherRoom,
      selection,
      selectedStation(sangbong),
      selectedStation(sangbong),
    ),
    {
      roomId: otherRoom.id,
      availability: [
        { date: '2028-02-29', slotId: '10:00' },
        { date: '2028-03-01', slotId: '23:00' },
      ],
      departureStationId: sangbong.id,
      destinationStationId: sangbong.id,
    },
  );
  assert.equal(
    prepareScheduleInput(
      otherRoom,
      new Set([key]),
      selectedStation(nowon),
      selectedStation(sangbong),
    ),
    null,
  );
});
