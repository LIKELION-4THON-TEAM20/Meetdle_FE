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

test('A26 and MINI_TIMER require at least half; MINI_TIMER also needs an incomplete member', () => {
  assert.equal(registrationFlow(room, now).canClose, true);
  assert.equal(registrationFlow(room, now).canMini, true);
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
      {
        ...three,
        registration: { ...three.registration, progress: { completedCount: 4, capacity: 4 } },
      },
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
  const voting = {
    round: room.registration.round,
    closesAt: new Date(now + 3_600_000).toISOString(),
    completion: [],
    myDraft: null,
  };
  assert.equal(roomScreenForEntry({ ...room, phase: 'RESULT_READY' }, path), '/rooms/vote/result');
  assert.equal(
    roomScreenForEntry(
      { ...room, phase: 'PLACE_SUBMISSION_CLOSED', allowedActions: ['START_VOTING'] },
      path,
    ),
    '/rooms/registration/status',
  );
  assert.equal(
    roomScreenForEntry(
      { ...room, phase: 'VOTING_OPEN', voting, allowedActions: ['EDIT_PREFERENCES'] },
      path,
    ),
    '/rooms/vote',
  );
  assert.equal(
    roomScreenForEntry(
      {
        ...room,
        phase: 'VOTING_OPEN',
        voting,
        me: { canVote: false },
        allowedActions: ['EDIT_PREFERENCES'],
      },
      path,
    ),
    '/rooms/vote/status',
  );
});

test('등록 마감 검토 화면은 진행 중에도 열고 전원 완료 시 투표 마감 설정으로 이동한다', () => {
  const closed = { ...room, phase: 'PLACE_SUBMISSION_CLOSED', allowedActions: ['START_VOTING'] };
  assert.equal(roomScreenForEntry(room, '/rooms/registration/close'), '/rooms/registration/close');
  assert.equal(roomScreenForEntry(closed, '/rooms/vote/start'), '/rooms/vote/start');
  assert.equal(
    roomScreenForEntry(
      {
        ...closed,
        registration: { ...closed.registration, progress: { completedCount: 4, capacity: 4 } },
      },
      '/rooms/registration/status',
    ),
    '/rooms/vote/start',
  );
});

test('마감 후 연장은 미완료자가 있거나 필수 후보가 비어 있어야 한다', () => {
  const closed = {
    ...room,
    phase: 'PLACE_SUBMISSION_CLOSED',
    allowedActions: ['EXTEND_COLLECTION'],
  };
  assert.equal(registrationFlow(closed, now).canExtend, true);
  const allDone = {
    ...closed,
    registration: { ...closed.registration, progress: { completedCount: 4, capacity: 4 } },
  };
  assert.equal(registrationFlow(allDone, now).canExtend, false);
  assert.equal(
    registrationFlow(
      { ...allDone, registration: { ...allDone.registration, categoryCounts: [] } },
      now,
    ).canExtend,
    true,
  );
  assert.equal(registrationFlow({ ...closed, allowedActions: [] }, now).canExtend, false);
  const belowHalf = {
    ...room,
    registration: { ...room.registration, progress: { completedCount: 1, capacity: 4 } },
  };
  assert.equal(registrationFlow(belowHalf, now).canMini, false);
});
