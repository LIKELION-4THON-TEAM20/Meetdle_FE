import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { rolldown } from 'rolldown';

async function loadModule(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

const { createResultMock } = await loadModule('../src/pages/VoteResult/mockData.ts');
const { getVotePercentages, moveVisitOrder, saveVisitOrder, incrementMockRevote } =
  await loadModule('../src/pages/VoteResult/resultUtils.ts');
for (const votes of [
  { like: 3, neutral: 1, dislike: 0 },
  { like: 2, neutral: 1, dislike: 1 },
  { like: 1, neutral: 2, dislike: 1 },
  { like: 1, neutral: 1, dislike: 1 },
  { like: 0, neutral: 0, dislike: 0 },
]) {
  const result = getVotePercentages(votes);
  assert.equal(result.like + result.neutral + result.dislike, result.total ? 100 : 0);
  assert.ok(Object.values(result).every(Number.isFinite));
}
assert.deepEqual(getVotePercentages({ like: 1, neutral: 1, dislike: 1 }), {
  like: 34,
  neutral: 33,
  dislike: 33,
  total: 3,
});
assert.deepEqual(getVotePercentages({ like: NaN, neutral: -1, dislike: Infinity }), {
  like: 0,
  neutral: 0,
  dislike: 0,
  total: 0,
});
const initial = createResultMock(null);
assert.deepEqual(
  initial.categories.map((category) => getVotePercentages(category.place.votes).like),
  [75, 50, 25],
);
assert.deepEqual(
  createResultMock('zeroVotes').categories.map(
    (category) => getVotePercentages(category.place.votes).total,
  ),
  [0, 0, 0],
);

// Pointer and keyboard operations share the same move/save path.
const moved = moveVisitOrder(initial.order, 'restaurant', 2);
assert.deepEqual(moved, ['cafe', 'pub', 'restaurant']);
assert.deepEqual(initial.order, ['restaurant', 'cafe', 'pub']);
const saved = saveVisitOrder(initial, moved, 'host');
assert.deepEqual(saved.order, moved);
moved.reverse();
assert.deepEqual(saved.order, ['cafe', 'pub', 'restaurant']);
assert.equal(saveVisitOrder(initial, ['cafe', 'pub', 'restaurant'], 'participant'), initial);
for (const order of [['cafe', 'cafe', 'pub'], ['cafe'], ['unknown', 'pub', 'restaurant']])
  assert.equal(saveVisitOrder(initial, order, 'host'), initial);
assert.equal(moveVisitOrder(initial.order, 'unknown', 0), initial.order);
assert.equal(moveVisitOrder(initial.order, 'cafe', -1), initial.order);
assert.equal(moveVisitOrder(initial.order, 'cafe', 3), initial.order);

const bundle = await rolldown({ input: 'src/features/mockRoom/model.ts', platform: 'node' });
const { output } = await bundle.generate({ format: 'esm' });
await bundle.close();
const { createMockRoom, reduceRoom, isMockRoom } = await import(
  `data:text/javascript;base64,${Buffer.from(output[0].code).toString('base64')}`
);
const now = Date.now();
let room = createMockRoom(now);
room = reduceRoom(room, { type: 'closeRegistration' });
room = reduceRoom(room, { type: 'start', deadline: now + 3600000, now });
const responses = Object.fromEntries(
  room.categories
    .filter(({ places }) => places.length > 1)
    .flatMap(({ places }) => places.map(({ id }) => [id, 'like'])),
);
room = {
  ...room,
  participants: room.participants.map((participant) => ({
    ...participant,
    vote: { submitted: true, responses },
  })),
};
room = reduceRoom(reduceRoom(room, { type: 'closeVote', now }), { type: 'count', now });
assert(room.ties.length > 1);
const finalize = { type: 'finalizeResult' };
assert.equal(reduceRoom(room, finalize), room);
const [firstTie] = room.ties;
const select = (tie, placeId) => ({ type: 'tie', categoryId: tie.id, placeId });
const participant = { ...room, role: 'participant', currentUserId: 'haneul' };
assert.equal(reduceRoom(participant, select(firstTie, firstTie.places[1].id)), participant);
assert.equal(reduceRoom(room, select(firstTie, 'unknown')), room);
for (const tie of room.ties) room = reduceRoom(room, select(tie, tie.places[1].id));
assert.equal(room.result.unresolvedTie, false);
assert.equal(
  room.result.categories.find(({ id }) => id === firstTie.id).place.id,
  firstTie.places[1].id,
);
const reversed = [...room.result.order].reverse();
room = reduceRoom(room, { type: 'order', order: reversed });
room = reduceRoom(room, select(firstTie, firstTie.places[0].id));
assert.equal(
  room.result.categories.find(({ id }) => id === firstTie.id).place.id,
  firstTie.places[0].id,
);
assert.deepEqual(room.result.order, reversed);
const finalized = reduceRoom(room, finalize);
assert.equal(finalized.result.finalized, true);
assert(isMockRoom(JSON.parse(JSON.stringify(finalized))));
assert.equal(reduceRoom(finalized, select(firstTie, firstTie.places[1].id)), finalized);
assert.equal(reduceRoom(finalized, { type: 'order', order: initial.order }), finalized);
assert.equal(reduceRoom(finalized, finalize), finalized);
const revoted = incrementMockRevote(createResultMock('noResult'));
assert.equal(revoted.revotesUsed, 1);
assert.equal(incrementMockRevote(revoted), revoted);
assert.equal(createResultMock('revoteUsed').revotesUsed, 1);
console.log(
  'SCREEN 14 passed: ratios and zero votes, order move/save and role guards, tie selection updates, single mock revote.',
);
