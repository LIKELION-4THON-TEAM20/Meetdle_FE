import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function loadModule(path, transform = (source) => source) {
  const source = transform(await readFile(new URL(path, import.meta.url), 'utf8'));
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const registration = await loadModule('../src/pages/PlaceRegistrationSetup/deadlineUtils.ts');
const vote = await loadModule('../src/pages/VoteStart/voteUtils.ts', (source) =>
  source.replace(/import \{ HOUR \} from .*?;/, `const HOUR = ${registration.HOUR};`),
);
const mocks = await loadModule('../src/pages/VoteStart/mockData.ts');
const now = new Date('2026-11-13T23:45:00+09:00');
const meeting = new Date(now.getTime() + 12 * registration.HOUR);
const minimum = now.getTime() + registration.HOUR / 2;
const maximum = meeting.getTime() - 3 * registration.HOUR;
for (const [time, expected] of [
  [minimum - 1, false],
  [minimum, true],
  [maximum, true],
  [maximum + 1, false],
  [NaN, false],
]) {
  assert.equal(vote.isValidVoteDeadline(new Date(time), now, meeting), expected);
}
assert.equal(
  vote.getVoteDeadlineWindow(now, new Date(now.getTime() + 3.5 * registration.HOUR)).canOpen,
  true,
);
assert.equal(
  vote.getVoteDeadlineWindow(now, new Date(now.getTime() + 3.5 * registration.HOUR - 1)).canOpen,
  false,
);
assert.equal(
  vote.isValidVoteDeadline(new Date(minimum), new Date(now.getTime() + 1), meeting),
  false,
);
assert.equal(vote.getVoteDeadlineWindow(new Date(NaN), meeting).canOpen, false);
assert.equal(registration.isValidDeadline(minimum, now.getTime(), meeting.getTime()), false);
for (const screen of ['close', 'vote']) {
  for (const scenario of [null, 'empty', 'missingRequired', 'missingOptional', 'invalidDeadline']) {
    const categories = mocks.createCandidateMock(screen, scenario);
    const summary = mocks.summarizeCandidates(categories);
    assert.equal(
      summary.total,
      summary.rows.reduce((sum, row) => sum + row.count, 0),
    );
    if (scenario === 'empty') assert.equal(summary.total, 0);
    if (scenario === 'missingRequired') assert.equal(summary.missingRequired[0].name, '식당');
    if (scenario === 'missingOptional') assert.equal(summary.excluded[0].name, '문화시설');
    if (!scenario) assert.equal(summary.total, screen === 'close' ? 6 : 8);
    categories[1].candidates.push({ id: 'invalid', valid: false });
    assert.equal(mocks.summarizeCandidates(categories).total, summary.total);
  }
}
console.log(
  'SCREEN 11: deadline boundaries, midnight crossing, expired values, SCREEN 08 isolation and candidate totals passed.',
);
