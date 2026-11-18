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
const { createRoomDispatcher } = await loadModule('src/features/mockRoom/dispatcher.ts');
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

test('room-specific required categories persist and guard registration close', () => {
  const initial = { ...createMockRoom(now), registrationStarted: false };
  const action = {
    type: 'startRegistration',
    categoryIds: ['restaurant', 'cafe', 'pub', 'culture'],
    requiredCategoryIds: ['pub'],
    deadline: now + 3600000,
    now,
  };
  assert.equal(reduceRoom(initial, { ...action, requiredCategoryIds: ['culture'] }), initial);
  assert.equal(reduceRoom(initial, { ...action, categoryIds: ['restaurant', 'cafe'] }), initial);
  const started = reduceRoom(initial, action);
  assert(isMockRoom(started));
  const restored = restoreRoom({ getItem: () => JSON.stringify(started) }, now);
  assert.deepEqual(
    candidateCategories(restored)
      .filter(({ required }) => required)
      .map(({ id }) => id),
    ['pub'],
  );
  const without = (id) => ({
    ...restored,
    categories: restored.categories.map((category) =>
      category.id === id ? { ...category, places: [] } : category,
    ),
  });
  const blocked = without('pub');
  assert.equal(reduceRoom(blocked, { type: 'closeRegistration' }), blocked);
  assert.equal(
    reduceRoom(without('restaurant'), { type: 'closeRegistration' }).registrationClosed,
    true,
  );
});

test('ballot entry is limited to the voting window and current unsubmitted member', () => {
  const room = start();
  const participant = { ...room, role: 'participant', currentUserId: 'haneul' };
  assert.equal(model.canOpenBallot(participant, now), true);
  assert.equal(model.canOpenBallot(participant, room.voteDeadline), false);
  assert.equal(model.canOpenBallot({ ...participant, currentUserId: 'jieun' }, now), false);
  assert.equal(model.canOpenBallot({ ...participant, phase: 'counting' }, now), false);
});
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
  assert.equal(reduceRoom(room, { type: 'closeVote', now }), room);
  assert.equal(reduceRoom(room, { type: 'closeVote', now: room.voteDeadline }), room);
  assert.equal(reduceRoom(room, { type: 'count', now: room.voteDeadline }), room);
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

test('expired voting reopens only with a valid host extension and retains ballots', () => {
  const room = start();
  const endedAt = room.voteDeadline;
  const action = { type: 'extendVote', now: endedAt, deadline: endedAt + 30 * 60_000 };
  assert.equal(reduceRoom(room, { ...action, now: endedAt - 1 }), room);
  assert.equal(reduceRoom(room, { ...action, deadline: action.deadline - 1 }), room);
  assert.equal(reduceRoom(room, { ...action, deadline: room.meetingAt }), room);
  const participant = { ...room, role: 'participant' };
  assert.equal(reduceRoom(participant, action), participant);
  const extended = reduceRoom(room, action);
  assert.equal(extended.voteDeadline, action.deadline);
  assert.equal(extended.registrationDeadline, room.registrationDeadline);
  assert.equal(extended.participants, room.participants);
  assert.deepEqual(restoreRoom({ getItem: () => JSON.stringify(extended) }, now), extended);
  const counting = { ...room, phase: 'counting' };
  assert.equal(reduceRoom(counting, action), counting);
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
  assert.equal(reduceRoom(room, { type: 'count', now }), room);
  room = reduceRoom(reduceRoom(room, { type: 'closeVote', now }), { type: 'count', now });
  assert.equal(room.ties.length, 3);
  const finalize = { type: 'finalizeResult' };
  assert.equal(reduceRoom(room, finalize), room);
  const firstTie = room.ties[0];
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
  assert.equal(reduceRoom(participant, finalize), participant);
  assert.equal(
    reduceRoom(participant, { type: 'order', order: [...reversed].reverse() }),
    participant,
  );
  const reselect = {
    type: 'tie',
    categoryId: firstTie.id,
    placeId: firstTie.places[0].id,
  };
  room = reduceRoom(room, reselect);
  assert.equal(room.result.categories[0].place.id, reselect.placeId);
  assert.deepEqual(room.result.order, reversed);
  const invalidOrder = {
    ...room,
    result: { ...room.result, order: reversed.map(() => reversed[0]) },
  };
  assert.equal(reduceRoom(invalidOrder, finalize), invalidOrder);
  const withoutRequired = {
    ...room,
    result: {
      ...room.result,
      categories: room.result.categories.filter(({ id }) => id !== 'restaurant'),
      order: reversed.filter((id) => id !== 'restaurant'),
    },
  };
  assert.equal(reduceRoom(withoutRequired, finalize), withoutRequired);
  const confirmed = reduceRoom(room, finalize);
  assert.equal(confirmed.result.finalized, true);
  assert.deepEqual(confirmed.result.order, reversed);
  assert.equal(isMockRoom(confirmed), true);
  assert.equal(
    restoreRoom({ getItem: () => JSON.stringify(confirmed) }, now).result.finalized,
    true,
  );
  assert.equal(reduceRoom(confirmed, finalize), confirmed);
  assert.equal(reduceRoom(confirmed, { type: 'order', order: [...reversed].reverse() }), confirmed);
  assert.equal(reduceRoom(confirmed, { ...reselect, placeId: firstTie.places[1].id }), confirmed);
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
  room = reduceRoom(reduceRoom(room, { type: 'closeVote', now }), { type: 'count', now });
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

test('malformed rendered result fields and candidate fields reset persisted rooms safely', () => {
  let room = answer(start());
  room = reduceRoom(room, { type: 'vote', action: { type: 'submit', now } });
  room = reduceRoom(room, { type: 'closeVote', now });
  room = reduceRoom(room, { type: 'count', now });
  assert.equal(isMockRoom(room), true);
  const corruptions = [
    (value) => {
      value.result.categories[0].name = { invalid: true };
    },
    (value) => {
      value.result.categories[0].id = {};
    },
    (value) => {
      value.result.categories[0].place = null;
    },
    ...['name', 'address', 'id', 'distanceMeters', 'kakaoMapUrl', 'tieVotes', 'votes'].map(
      (field) => (value) => {
        value.result.categories[0].place[field] = { invalid: true };
      },
    ),
    (value) => {
      value.result.categories[0].place.votes.like = -1;
    },
    (value) => {
      value.categories[0].name = {};
    },
    (value) => {
      value.categories[0].places[0].name = {};
    },
    (value) => {
      value.categories[0].places[0].address = {};
    },
    (value) => {
      value.categories[0].places[0].kakaoMapUrl = {};
    },
    (value) => {
      value.participants[0].name = {};
    },
  ];
  for (const corrupt of corruptions) {
    const malformed = structuredClone(room);
    corrupt(malformed);
    assert.equal(isMockRoom(malformed), false);
    assert.deepEqual(
      restoreRoom({ getItem: () => JSON.stringify(malformed) }, now),
      createMockRoom(now),
    );
  }
});

test('tie rendering fields are validated and valid ties survive restoration', () => {
  let room = answer(start());
  const responses = currentVote(room).responses;
  room = {
    ...room,
    participants: room.participants.map((participant) => ({
      ...participant,
      vote: { submitted: true, responses: { ...responses } },
    })),
  };
  room = reduceRoom(reduceRoom(room, { type: 'closeVote', now }), { type: 'count', now });
  assert.ok(room.ties.length > 0);
  assert.equal(isMockRoom(room), true);
  assert.deepEqual(restoreRoom({ getItem: () => JSON.stringify(room) }, now), room);
  for (const field of ['name', 'address', 'distanceMeters', 'kakaoMapUrl', 'tieVotes']) {
    const malformed = structuredClone(room);
    malformed.ties[0].places[0][field] = {};
    assert.equal(isMockRoom(malformed), false);
    assert.deepEqual(
      restoreRoom({ getItem: () => JSON.stringify(malformed) }, now),
      createMockRoom(now),
    );
  }
  const malformed = structuredClone(room);
  malformed.ties[0].name = {};
  assert.equal(isMockRoom(malformed), false);
});

test('consecutive commands use latest state and persist every accepted change', () => {
  const updates = [];
  let persisted = null;
  const send = createRoomDispatcher(createMockRoom(now), (room) => {
    updates.push(room);
    persisted = JSON.stringify(room);
  });
  assert.equal(send({ type: 'closeRegistration' }), true);
  assert.equal(send({ type: 'start', deadline: now + 3600000, now }), true);
  for (const placeId of ['restaurant-a', 'restaurant-b']) {
    assert.equal(
      send({ type: 'vote', action: { type: 'choose', placeId, choice: 'like', now } }),
      true,
    );
  }
  assert.deepEqual(currentVote(updates.at(-1)).responses, {
    'restaurant-a': 'like',
    'restaurant-b': 'like',
  });
  assert.deepEqual(restoreRoom({ getItem: () => persisted }, now), updates.at(-1));
  assert.equal(send({ type: 'closeVote', now: now + 3600000 }), false);
  assert.equal(updates.at(-1).phase, 'voting');
  const count = updates.length;
  assert.equal(send({ type: 'vote', action: { type: 'submit', now: now + 3600000 } }), false);
  assert.equal(updates.length, count);
  assert.deepEqual(restoreRoom({ getItem: () => persisted }, now), updates.at(-1));
});
