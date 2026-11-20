import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';
const vite = await createServer({
  envDir: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
});
after(() => vite.close());
const { candidatesForTimeReselection } = await vite.ssrLoadModule(
  '/src/features/planning/timeReselection.ts',
);
const { reconcileSelection, getConfirmationRequest } = await vite.ssrLoadModule(
  '/src/pages/TimeRegionCandidates/candidateUtils.ts',
);
const now = Date.parse('2026-11-20T00:00:00Z'),
  hour = 3600000;
const state = {
  options: {
    optionsId: 'options',
    inputVersion: 7,
    slots: [-1, 3 - 1 / 3600000, 3, 5].map((hours, i) => ({
      slotId: 's' + i,
      meetingAt: new Date(now + hours * hour).toISOString(),
    })),
    regions: [{ candidateId: 'r1' }],
  },
};
test('재선택에서는 지난 시간과 3시간 미만 후보를 숨기며 정확히 3시간인 후보는 유지한다', () => {
  const view = candidatesForTimeReselection(state, now);
  assert.deepEqual(
    view.options.slots.map((s) => s.slotId),
    ['s2', 's3'],
  );
  assert.equal(view.options.optionsId, state.options.optionsId);
  assert.equal(view.options.regions, state.options.regions);
  assert.equal(state.options.slots.length, 4);
});
test('시간이 지나 선택한 후보가 만료되면 선택을 해제하고 확정을 막는다', () => {
  const remaining = candidatesForTimeReselection(state, now + 1).options.slots;
  const data = {
    timeCandidates: remaining.map((s) => ({ id: s.slotId })),
    regionCandidates: [{ id: 'r1' }],
  };
  const selected = { timeCandidateId: 's2', regionCandidateId: 'r1' };
  assert.equal(reconcileSelection(data, selected).timeCandidateId, null);
  assert.equal(getConfirmationRequest(data, selected), null);
});
test('후보 전체가 임박했거나 options가 없으면 새 후보를 만들지 않는다', () => {
  assert.equal(candidatesForTimeReselection(state, now + 6 * hour).options.slots.length, 0);
  const noOptions = { options: null };
  assert.equal(candidatesForTimeReselection(noOptions, now), noOptions);
});
