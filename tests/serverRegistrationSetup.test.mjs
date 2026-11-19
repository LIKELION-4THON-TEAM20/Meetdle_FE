import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const vite = await createServer({
  envDir: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
});
after(() => vite.close());
const { registrationWindow, registrationRequest, parseSeoulInput, seoulInput, setupCategories } =
  await vite.ssrLoadModule('/src/pages/PlaceRegistrationSetup/serverSetupModel.ts');
const { roomScreenForEntry } = await vite.ssrLoadModule('/src/features/serverRoom/routing.ts');

const now = Date.parse('2026-11-19T15:23:00Z');
const hour = 3_600_000;
const room = {
  phase: 'REGION_CONFIRMED',
  serverNow: new Date(now).toISOString(),
  me: { role: 'HOST', canRegister: true },
  allowedActions: ['OPEN_COLLECTION'],
  meeting: { selectionId: 'current', meetingAt: new Date(now + 6 * hour).toISOString() },
};
const availability = {
  selectionId: 'current',
  categories: [
    { category: 'FOOD', available: true, radiusMeters: 2500 },
    { category: 'CAFE', available: false, radiusMeters: 3000 },
    { category: 'CULTURE', available: true, radiusMeters: 3000 },
    { category: 'BAR', available: true, radiusMeters: 2500 },
  ],
};

test('deadline uses server policy and fallback six-hour and cutoff boundaries', () => {
  const fallback = registrationWindow(room, now);
  assert.equal(fallback.minimum, now + hour);
  assert.equal(fallback.maximum, now + 2.5 * hour);
  assert.equal(registrationWindow(room, now + 1).minimumMinutes, 30);
  assert.equal(registrationWindow(room, now + 2 * hour).canOpen, true);
  assert.equal(registrationWindow(room, now + 2 * hour + 1).canOpen, false);
  assert.equal(
    registrationWindow(
      {
        ...room,
        deadlinePolicy: {
          registrationMinimumMinutes: 42,
          registrationCutoff: new Date(now + hour).toISOString(),
        },
      },
      now,
    ).minimum,
    now + 42 * 60_000,
  );
  assert.equal(seoulInput(now), '2026-11-20T00:23');
  assert.equal(parseSeoulInput('2026-11-20T00:23'), now);
  assert.ok(Number.isNaN(parseSeoulInput('2026-02-30T15:00')));
});

test('A13 request omits default deadline, validates exact boundaries and rejects stale or unavailable categories', () => {
  const body = registrationRequest(room, availability, ['restaurant', 'pub'], now);
  assert.deepEqual(body, { selectionId: 'current', requiredCategories: ['BAR', 'FOOD'] });
  for (const ids of [[], ['restaurant', 'restaurant'], ['culture'], ['cafe']]) {
    assert.equal(registrationRequest(room, availability, ids, now), null);
  }
  assert.equal(
    registrationRequest(room, { ...availability, selectionId: 'old' }, ['restaurant'], now),
    null,
  );
  assert.equal(
    registrationRequest({ ...room, me: { role: 'MEMBER' } }, availability, ['restaurant'], now),
    null,
  );
  assert.equal(
    registrationRequest({ ...room, allowedActions: [] }, availability, ['restaurant'], now),
    null,
  );
  const { minimum, maximum } = registrationWindow(room, now);
  for (const deadline of [minimum, maximum]) {
    assert.equal(
      registrationRequest(room, availability, ['restaurant'], now, deadline).closesAt,
      new Date(deadline).toISOString(),
    );
  }
  for (const deadline of [minimum - 1, maximum + 1, NaN]) {
    assert.equal(registrationRequest(room, availability, ['restaurant'], now, deadline), null);
  }
  assert.equal(setupCategories(availability).find(({ id }) => id === 'cafe').radiusMeters, 3000);
});

test('setup directs open rounds to SCREEN 09 or 10 and denies member setup', () => {
  const setup = '/rooms/registration/setup';
  assert.equal(roomScreenForEntry(room, setup), setup);
  assert.equal(roomScreenForEntry({ ...room, me: { role: 'MEMBER' } }, setup), '/rooms/info');
  const open = {
    ...room,
    phase: 'PLACE_SUBMISSION_OPEN',
    allowedActions: ['EDIT_NOMINATION'],
    registration: { closesAt: new Date(now + hour).toISOString(), myCompleted: false },
  };
  assert.equal(roomScreenForEntry(open, setup), '/rooms/places');
  assert.equal(
    roomScreenForEntry(
      { ...open, registration: { ...open.registration, myCompleted: true } },
      setup,
    ),
    '/rooms/registration/status',
  );
});
