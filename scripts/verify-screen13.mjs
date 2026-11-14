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

const { getVoteStatusSummary } = await loadModule('../src/pages/VoteStatus/statusUtils.ts');
const { createVoteStatusMock, FIXED_STATUS_NOW } = await loadModule(
  '../src/pages/VoteStatus/mockData.ts',
);
const { formatVoteRemaining } = await loadModule('../src/pages/PlaceVote/voteUtils.ts');
const now = FIXED_STATUS_NOW;
const participants = (total, completed) =>
  Array.from({ length: total }, (_, index) => ({
    id: String(index),
    name: `참여자 ${index}`,
    completed: index < completed,
  }));
for (const [total, completed, phase, majority] of [
  [0, 0, 'insufficient', false],
  [1, 0, 'insufficient', false],
  [1, 1, 'allCompleted', true],
  [4, 0, 'insufficient', false],
  [4, 1, 'insufficient', false],
  [4, 2, 'insufficient', false],
  [4, 3, 'counting', true],
  [4, 4, 'allCompleted', true],
  [5, 2, 'insufficient', false],
  [5, 3, 'counting', true],
]) {
  const summary = getVoteStatusSummary(participants(total, completed), now, now);
  assert.equal(summary.phase, phase);
  assert.equal(summary.hasMajority, majority);
  assert.equal(summary.total, total);
  assert.equal(summary.completed, completed);
  assert.equal(summary.progress, total ? (completed / total) * 100 : 0);
  assert.ok(Number.isFinite(summary.progress));
}
assert.equal(getVoteStatusSummary([], now + 1, now).allCompleted, false);
assert.equal(getVoteStatusSummary(participants(4, 3), now + 1, now).phase, 'ongoing');
assert.equal(getVoteStatusSummary(participants(4, 4), now + 1, now).phase, 'allCompleted');
assert.equal(getVoteStatusSummary(participants(4, 3), now + 1, now, true).phase, 'counting');
assert.equal(getVoteStatusSummary(participants(4, 2), now + 1, now, true).phase, 'insufficient');
assert.equal(getVoteStatusSummary(participants(4, 3), now + 1, now + 1).phase, 'counting');
for (const [scenario, phase, completed] of [
  [null, 'ongoing', 3],
  ['ongoing', 'ongoing', 3],
  ['allCompleted', 'allCompleted', 4],
  ['expired', 'counting', 3],
  ['insufficient', 'insufficient', 1],
]) {
  const mock = createVoteStatusMock(now, scenario);
  const summary = getVoteStatusSummary(mock.participants, mock.deadline, now);
  assert.equal(summary.phase, phase);
  assert.equal(summary.completed, completed);
  if (phase === 'ongoing') assert.equal(formatVoteRemaining(mock.deadline, now), '02:15:30');
}
assert.equal(formatVoteRemaining(now - 1, now), '00:00:00');
console.log(
  'SCREEN 13 passed: 0/1 participants, all completed, strict majority boundaries, deadline boundary, early close and DEV fixtures.',
);
