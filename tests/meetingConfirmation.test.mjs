import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
});
after(() => server.close());

const { createCandidateConfirmation, getMeetingConfirmation, getConfirmationRegistrationStatus } =
  await server.ssrLoadModule('/src/pages/MeetingConfirmed/confirmationData.ts');
const { MOCK_CANDIDATE_DATA: data } = await server.ssrLoadModule(
  '/src/pages/TimeRegionCandidates/mockData.ts',
);
const { createMockRoom, reduceRoom, restoreRoom, saveRoom } = await server.ssrLoadModule(
  '/src/features/mockRoom/model.ts',
);
const previewId = 'mock-created-preview';
const now = Date.parse('2026-11-18T12:00:00+09:00');

test('selected time and region drive both cards and survive room-scoped restoration', () => {
  const entries = new Map();
  const storage = {
    getItem: (key) => entries.get(key),
    setItem: (key, value) => entries.set(key, value),
  };
  const [time] = data.timeCandidates.slice(1);
  const [region] = data.regionCandidates;
  const confirmed = createCandidateConfirmation(
    data,
    { timeCandidateId: time.id, regionCandidateId: region.id },
    now,
    previewId,
  );
  saveRoom(storage, confirmed);
  const restored = restoreRoom(storage, now, previewId);
  const meeting = getMeetingConfirmation(restored);
  assert.equal(meeting.dateTime, '11월 16일 월요일 · 19:00');
  assert.equal(meeting.summaryDateTime, '11월 16일 (월) 19:00–21:00');
  assert.equal(meeting.area, '건대입구역 근처');
  assert.equal(meeting.totalCount, 4);
  assert.equal(meeting.availableCount, 3);
  assert.equal(meeting.averageTravelMinutes, 29);
  assert.equal(meeting.maximumTravelMinutes, 38);
  assert.equal(meeting.averageTransfers, 0.7);
  assert.equal(restoreRoom(storage, now).id, 'mock-room-10-14');
});

test('registration starts once with valid host settings and restores for the same room', () => {
  const room = createMockRoom(now, previewId);
  const action = {
    type: 'startRegistration',
    categoryIds: ['restaurant', 'cafe', 'culture'],
    deadline: now + 60 * 60 * 1000,
    now,
  };
  assert.equal(reduceRoom(room, { ...action, deadline: action.deadline - 1 }), room);
  assert.equal(reduceRoom(room, { ...action, categoryIds: ['restaurant', 'pub'] }), room);
  const participant = { ...room, role: 'participant' };
  assert.equal(reduceRoom(participant, action), participant);
  const started = reduceRoom(room, action);
  assert.equal(reduceRoom(started, action), started);
  const entries = new Map();
  const storage = {
    getItem: (key) => entries.get(key),
    setItem: (key, value) => entries.set(key, value),
  };
  saveRoom(storage, started);
  const restored = restoreRoom(storage, now, previewId);
  assert.deepEqual(restored.registrationCategoryIds, action.categoryIds);
  assert.equal(restored.registrationDeadline, action.deadline);
  assert.equal(getConfirmationRegistrationStatus(restored, null), 'registrationOpen');
});

test('registration state comes from the room and supports the existing preview overrides', () => {
  const room = createMockRoom(now, previewId);
  assert.equal(getConfirmationRegistrationStatus(room, null), 'beforeRegistration');
  assert.equal(getConfirmationRegistrationStatus(room, 'registrationOpen'), 'registrationOpen');
  assert.equal(
    getConfirmationRegistrationStatus({ ...room, registrationStarted: true }, null),
    'registrationOpen',
  );
  assert.equal(
    getConfirmationRegistrationStatus({ ...room, registrationClosed: true }, null),
    'registrationClosed',
  );
  assert.equal(getConfirmationRegistrationStatus(createMockRoom(now), null), 'registrationOpen');
});
