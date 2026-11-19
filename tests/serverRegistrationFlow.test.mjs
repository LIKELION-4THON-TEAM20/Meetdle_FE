import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const vite = await createServer({
  envDir: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
});
after(() => vite.close());

const { registrationFlow, flowDeadline } = await vite.ssrLoadModule(
  '/src/features/serverRoom/registrationFlow.ts',
);
const { roomScreenForEntry } = await vite.ssrLoadModule('/src/features/serverRoom/routing.ts');
const now = Date.parse('2026-11-19T00:00:00Z');
const start = now + 8 * 3_600_000;
const room = {
  phase: 'PLACE_SUBMISSION_OPEN',
  serverNow: new Date(now).toISOString(),
  capacity: 4,
  me: { role: 'HOST', canVote: true },
  allowedActions: ['CLOSE_COLLECTION', 'START_MINI_TIMER'],
  meeting: { meetingAt: new Date(start).toISOString() },
  registration: {
    round: 3,
    closesAt: new Date(now + 3_600_000).toISOString(),
    closedAt: null,
    progress: { completedCount: 2, capacity: 4 },
    completion: [{}, {}, {}, {}],
    categories: [
      { category: 'FOOD', required: true, available: true },
      { category: 'CAFE', required: false, available: true },
      { category: 'BAR', required: false, available: true },
    ],
    categoryCounts: [
      { category: 'FOOD', count: 2 },
      { category: 'CAFE', count: 1 },
    ],
  },
};

test('A26 rounds half up while MINI_TIMER requires strict majority and an incomplete round member', () => {
  assert.equal(registrationFlow(room, now).canClose, true);
  assert.equal(registrationFlow(room, now).canMini, false);
  const three = {
    ...room,
    registration: { ...room.registration, progress: { completedCount: 3, capacity: 4 } },
  };
  assert.equal(registrationFlow(three, now).canMini, true);
  assert.equal(
    registrationFlow({ ...three, allowedActions: ['CLOSE_COLLECTION'] }, now).canMini,
    false,
  );
  assert.equal(registrationFlow({ ...three, me: { role: 'MEMBER' } }, now).canClose, false);
  assert.equal(
    registrationFlow(
      { ...three, registration: { ...three.registration, completion: [{}, {}, {}] } },
      now,
    ).canMini,
    false,
  );
  assert.equal(registrationFlow(three, Date.parse(room.registration.closesAt)).canClose, false);
});

test('closed round counts distinguish optional singletons and required candidates with no results', () => {
  const closed = {
    ...room,
    phase: 'PLACE_SUBMISSION_CLOSED',
    allowedActions: ['EXTEND_COLLECTION', 'START_VOTING'],
  };
  const view = registrationFlow(closed, now);
  assert.equal(view.canExtend, true);
  assert.equal(view.canVote, true);
  assert.deepEqual(
    view.rows.map(({ category, count }) => [category, count]),
    [
      ['FOOD', 2],
      ['CAFE', 1],
      ['BAR', 0],
    ],
  );
  const missing = {
    ...closed,
    registration: { ...room.registration, categoryCounts: [{ category: 'CAFE', count: 2 }] },
  };
  assert.equal(registrationFlow(missing, now).canVote, false);
  assert.equal(registrationFlow(missing, now).missing[0].category, 'FOOD');
  const automatic = {
    ...closed,
    registration: {
      ...room.registration,
      categoryCounts: [
        { category: 'FOOD', count: 1 },
        { category: 'CAFE', count: 1 },
      ],
    },
  };
  assert.equal(registrationFlow(automatic, now).canVote, false);
  const withheld = { ...closed, registration: { ...room.registration, categoryCounts: null } };
  assert.ok(registrationFlow(withheld, now).rows.every(({ count }) => count === undefined));
});

test('MINI_TIMER must extend the current cutoff, EXTEND may reopen from now, and A17 uses the server window', () => {
  assert.deepEqual(flowDeadline(room, 'MINI_TIMER', now), {
    minimum: Date.parse(room.registration.closesAt) + 1,
    maximum: start - 3.5 * 3_600_000,
  });
  assert.equal(flowDeadline(room, 'EXTEND', now).minimum, now + 1);
  assert.deepEqual(flowDeadline(room, 'VOTE', now), {
    minimum: now + 30 * 60_000,
    maximum: start - 3 * 3_600_000,
  });
  assert.equal(
    flowDeadline({ ...room, deadlinePolicy: { votingMinimumMinutes: 40 } }, 'VOTE', now).minimum,
    now + 40 * 60_000,
  );
});

test('server routes skip SCREEN 11 when the result is ready and use permission for ballots', () => {
  const path = '/rooms/registration/status';
  assert.equal(roomScreenForEntry({ ...room, phase: 'RESULT_READY' }, path), '/rooms/vote/result');
  assert.equal(
    roomScreenForEntry(
      { ...room, phase: 'PLACE_SUBMISSION_CLOSED', allowedActions: ['START_VOTING'] },
      path,
    ),
    '/rooms/vote/start',
  );
  assert.equal(
    roomScreenForEntry(
      { ...room, phase: 'VOTING_OPEN', allowedActions: ['EDIT_PREFERENCES'] },
      path,
    ),
    '/rooms/vote',
  );
  assert.equal(
    roomScreenForEntry(
      {
        ...room,
        phase: 'VOTING_OPEN',
        me: { canVote: false },
        allowedActions: ['EDIT_PREFERENCES'],
      },
      path,
    ),
    '/rooms/vote/status',
  );
});
