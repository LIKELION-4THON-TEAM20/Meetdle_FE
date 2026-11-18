import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
});
after(() => server.close());

const { getMockParticipants } = await server.ssrLoadModule(
  '/src/pages/ParticipationStatus/mockData.ts',
);
const { getParticipationActions } = await server.ssrLoadModule(
  '/src/pages/ParticipationStatus/participationPolicy.ts',
);

test('default and development scenarios expose the expected completed counts', () => {
  for (const [scenario, completed] of [
    [null, 2],
    ['oneCompleted', 1],
    ['twoCompleted', 2],
    ['threeCompleted', 3],
    ['allCompleted', 4],
  ]) {
    const people = getMockParticipants(scenario);
    assert.equal(people.length, 4);
    assert.equal(people.filter(({ status }) => status === 'completed').length, completed);
  }
  assert.deepEqual(
    getMockParticipants(null).map(({ status }) => status),
    ['completed', 'completed', 'inProgress', 'notStarted'],
  );
});

test('candidate calculation needs two submissions and host notification needs every submission', () => {
  for (const [count, minimum, reminder, showNotification, notify] of [
    [1, false, true, false, false],
    [2, true, true, true, false],
    [3, true, true, true, false],
    [4, true, false, true, true],
  ]) {
    assert.deepEqual(getParticipationActions(count, 4), {
      meetsMinimum: minimum,
      allCompleted: count === 4,
      showReminder: reminder,
      showHostNotification: showNotification,
      canNotifyHost: notify,
    });
  }
  assert.equal(getParticipationActions(0, 0).canNotifyHost, false);
});
