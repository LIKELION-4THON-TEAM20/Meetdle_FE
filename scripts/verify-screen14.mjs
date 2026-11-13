import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function loadModule(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

const { createResultMock, tieCandidates } = await loadModule('../src/pages/VoteResult/mockData.ts');
const { getVotePercentages, moveVisitOrder, saveVisitOrder, selectTiePlace, incrementMockRevote } =
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
assert.deepEqual(moved, ['cafe', 'bar', 'restaurant']);
assert.deepEqual(initial.order, ['restaurant', 'cafe', 'bar']);
const saved = saveVisitOrder(initial, moved, 'host');
assert.deepEqual(saved.order, moved);
moved.reverse();
assert.deepEqual(saved.order, ['cafe', 'bar', 'restaurant']);
assert.equal(saveVisitOrder(initial, ['cafe', 'bar', 'restaurant'], 'participant'), initial);
for (const order of [['cafe', 'cafe', 'bar'], ['cafe'], ['unknown', 'bar', 'restaurant']])
  assert.equal(saveVisitOrder(initial, order, 'host'), initial);
assert.equal(moveVisitOrder(initial.order, 'unknown', 0), initial.order);
assert.equal(moveVisitOrder(initial.order, 'cafe', -1), initial.order);
assert.equal(moveVisitOrder(initial.order, 'cafe', 3), initial.order);

const tie = createResultMock('tie');
assert.equal(selectTiePlace(tie, 'cafe', 'cafe-e', tieCandidates, 'participant'), tie);
assert.equal(selectTiePlace(tie, 'cafe', 'unknown', tieCandidates, 'host'), tie);
const selected = selectTiePlace(tie, 'cafe', 'cafe-e', tieCandidates, 'host');
assert.equal(selected.unresolvedTie, false);
assert.equal(selected.categories.find((category) => category.id === 'cafe').place.name, 'E 카페');
assert.deepEqual(selected.order, tie.order);
assert.equal(selectTiePlace(selected, 'cafe', 'cafe-c', tieCandidates, 'host'), selected);
assert.equal(
  getVotePercentages(selected.categories.find((category) => category.id === 'cafe').place.votes)
    .neutral,
  50,
);
const revoted = incrementMockRevote(createResultMock('noResult'));
assert.equal(revoted.revotesUsed, 1);
assert.equal(incrementMockRevote(revoted), revoted);
assert.equal(createResultMock('revoteUsed').revotesUsed, 1);
console.log(
  'SCREEN 14 passed: ratios and zero votes, order move/save and role guards, tie selection updates, single mock revote.',
);
