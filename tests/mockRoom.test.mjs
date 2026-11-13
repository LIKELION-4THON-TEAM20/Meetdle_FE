import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rolldown } from 'rolldown';

// Use Vite's installed TS bundler; no test runner or runtime dependency added.
async function loadModule(input) {
  const bundle = await rolldown({ input, platform: 'node' });
  const { output } = await bundle.generate({ format: 'esm' });
  await bundle.close();
  return import(`data:text/javascript;base64,${Buffer.from(output[0].code).toString('base64')}`);
}
const model = await loadModule('src/features/mockRoom/model.ts');
const { getVotePercentages } = await loadModule('src/pages/VoteResult/resultUtils.ts');
const {
  createMockRoom,
  reduceRoom,
  completedVoters,
  candidateCategories,
  currentVote,
  categoryId,
  canCount,
  isMockRoom,
  restoreRoom,
  STORAGE_KEY,
} = model;
const now = new Date('2026-11-13T09:00:00Z').getTime();
function start(room = createMockRoom(now)) {
  room = reduceRoom(room, { type: 'closeRegistration' });
  return reduceRoom(room, { type: 'start', deadline: now + 3600000, now });
}
function answer(room, choice = 'like') {
  for (const category of room.categories.filter(({ places }) => places.length > 1)) {
    for (const place of category.places)
      room = reduceRoom(room, {
        type: 'vote',
        action: { type: 'choose', placeId: place.id, choice, now },
      });
  }
  return room;
}

test('10→14: canonical candidates, submit completion, aggregate, session round-trip', () => {
  let room = start();
  assert.equal(room.phase, 'voting');
  assert.deepEqual(
    room.categories.map(({ id }) => id),
    ['restaurant', 'cafe', 'pub', 'culture'],
  );
  assert.deepEqual(['0', '1', '2', '3', 'bar'].map(categoryId), [
    'restaurant',
    'cafe',
    'pub',
    'culture',
    'pub',
  ]);
  assert.equal(
    candidateCategories(room).reduce((n, category) => n + category.candidates.length, 0),
    8,
  );
  assert.equal(completedVoters(room).length, 2);
  assert.equal(reduceRoom(room, { type: 'vote', action: { type: 'submit', now } }), room);
  room = answer(room);
  assert.equal(Object.keys(currentVote(room).responses).length, 7);
  room = reduceRoom(room, { type: 'vote', action: { type: 'submit', now } });
  assert.equal(completedVoters(room).length, 3);
  assert.equal(
    reduceRoom(room, {
      type: 'vote',
      action: { type: 'choose', placeId: 'restaurant-a', choice: 'dislike', now },
    }),
    room,
  );
  assert.equal(canCount(room, now), false);
  room = reduceRoom(room, { type: 'closeVote', now });
  assert.equal(room.phase, 'counting');
  assert.equal(room.result, null);
  room = reduceRoom(room, { type: 'count', now });
  assert.equal(room.result.categories.length, 4);
  assert.deepEqual(room.result.categories[0].place.votes, { like: 3, neutral: 0, dislike: 0 });
  assert.deepEqual(room.result.categories[3].place.votes, { like: 0, neutral: 0, dislike: 0 });
  assert.equal(isMockRoom(room), true);
  const persisted = JSON.stringify(room);
  assert.deepEqual(
    restoreRoom(
      {
        getItem: (key) => {
          assert.equal(key, STORAGE_KEY);
          return persisted;
        },
      },
      now,
    ),
    room,
  );
});

test('host authorization and direct-entry stage guards', () => {
  let room = createMockRoom(now);
  assert.equal(reduceRoom(room, { type: 'start', deadline: now + 3600000, now }), room);
  assert.equal(reduceRoom(room, { type: 'count', now }), room);
  const participant = { ...room, role: 'participant', currentUserId: 'haneul' };
  for (const action of [
    { type: 'closeRegistration' },
    { type: 'extend', minutes: 60, now },
    { type: 'start', deadline: now + 3600000, now },
    { type: 'closeVote', now },
  ])
    assert.equal(reduceRoom(participant, action), participant);
  room = { ...start(), role: 'participant', currentUserId: 'haneul' };
  room = answer(room);
  room = reduceRoom(room, { type: 'vote', action: { type: 'submit', now } });
  assert.equal(currentVote(room).submitted, true);
});

test('deadline validation, expiration, strict majority and incomplete ballots', () => {
  let room = reduceRoom(createMockRoom(now), { type: 'closeRegistration' });
  for (const deadline of [now, now + 29 * 60000, room.meetingAt])
    assert.equal(reduceRoom(room, { type: 'start', deadline, now }), room);
  room = start();
  const expired = reduceRoom(room, { type: 'tick', now: room.voteDeadline });
  assert.equal(expired.phase, 'insufficient');
  assert.equal(reduceRoom(expired, { type: 'count', now: room.voteDeadline }), expired);
  assert.equal(
    completedVoters({
      ...room,
      participants: room.participants.map((participant) => ({
        ...participant,
        vote: { submitted: true, responses: {} },
      })),
    }).length,
    0,
  );
});

test('missing required, zero candidates and all-automatic categories', () => {
  for (const emptyAll of [true, false]) {
    const room = createMockRoom(now);
    room.categories = room.categories.map((category, index) => ({
      ...category,
      places: emptyAll || index === 0 ? [] : category.places,
    }));
    assert.equal(reduceRoom(room, { type: 'closeRegistration' }), room);
  }
  let room = createMockRoom(now);
  room.categories = room.categories.map((category) => ({
    ...category,
    places: category.places.slice(0, 1),
  }));
  room = start(room);
  room = reduceRoom(room, { type: 'vote', action: { type: 'submit', now } });
  assert.equal(currentVote(room).submitted, true);
});

test('multiple ties stay unresolved, participant cannot choose or save order', () => {
  let room = start();
  const responses = Object.fromEntries(
    room.categories
      .filter(({ places }) => places.length > 1)
      .flatMap(({ places }) => places.map(({ id }) => [id, 'like'])),
  );
  room.participants = room.participants.map((participant) => ({
    ...participant,
    vote: { responses: { ...responses }, submitted: true },
  }));
  room = reduceRoom(room, { type: 'count', now });
  assert.equal(room.ties.length, 3);
  while (room.ties.length) {
    const tie = room.ties[0];
    const action = { type: 'tie', categoryId: tie.id, placeId: tie.places[1].id };
    const participant = { ...room, role: 'participant' };
    assert.equal(reduceRoom(participant, action), participant);
    room = reduceRoom(room, action);
    assert.equal(room.result.unresolvedTie, room.ties.length > 0);
  }
  const reversed = [...room.result.order].reverse();
  room = reduceRoom(room, { type: 'order', order: reversed });
  assert.deepEqual(room.result.order, reversed);
  const participant = { ...room, role: 'participant' };
  assert.equal(
    reduceRoom(participant, { type: 'order', order: [...reversed].reverse() }),
    participant,
  );
});

test('selection failure never invents a winner; malformed storage resets safely', () => {
  let room = start();
  const responses = Object.fromEntries(
    room.categories
      .filter(({ places }) => places.length > 1)
      .flatMap(({ places }) => places.map(({ id }) => [id, 'dislike'])),
  );
  room.participants = room.participants.map((participant) => ({
    ...participant,
    vote: { responses: { ...responses }, submitted: true },
  }));
  room = reduceRoom(room, { type: 'count', now });
  assert.equal(room.result.categories.length, 0);
  for (const value of [
    '{',
    '{}',
    JSON.stringify({ ...room, participants: null }),
    JSON.stringify({ ...room, currentUserId: 'missing' }),
  ]) {
    assert.deepEqual(restoreRoom({ getItem: () => value }, now), createMockRoom(now));
  }
  assert.deepEqual(
    restoreRoom(
      {
        getItem: () => {
          throw Error('blocked');
        },
      },
      now,
    ),
    createMockRoom(now),
  );
});

test('draft responses and configured deadline survive restoration; extension guards', () => {
  let room = createMockRoom(now);
  room = reduceRoom(room, { type: 'extend', minutes: 60, now });
  assert.equal(room.registrationDeadline, now + 3 * 3600000);
  assert.equal(
    reduceRoom(room, { type: 'extend', minutes: 60, now: room.registrationDeadline }),
    room,
  );
  room = reduceRoom(room, { type: 'closeRegistration' });
  room = reduceRoom(room, { type: 'deadline', deadline: now + 4 * 3600000, now });
  const restore = (value) => restoreRoom({ getItem: () => JSON.stringify(value) }, now);
  assert.equal(restore(room).voteDeadline, now + 4 * 3600000);
  room = reduceRoom(room, { type: 'start', deadline: room.voteDeadline, now });
  room = reduceRoom(room, {
    type: 'vote',
    action: { type: 'choose', placeId: 'restaurant-b', choice: 'neutral', now },
  });
  assert.deepEqual(currentVote(restore(room)).responses, { 'restaurant-b': 'neutral' });
});

test('displayed vote ratios total 100%, or zero when there are no votes', () => {
  for (const votes of [
    { like: 1, neutral: 1, dislike: 1 },
    { like: 2, neutral: 1, dislike: 0 },
    { like: 0, neutral: 0, dislike: 0 },
  ]) {
    const percentages = getVotePercentages(votes);
    assert.equal(
      percentages.like + percentages.neutral + percentages.dislike,
      percentages.total ? 100 : 0,
    );
    assert.equal(percentages.total, votes.like + votes.neutral + votes.dislike);
  }
});
