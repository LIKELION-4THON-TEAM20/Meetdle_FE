import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';
const vite = await createServer({
  envDir: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
});
after(() => vite.close());
const { buildShareMessage, assertShareStage, sharePurpose } = await vite.ssrLoadModule(
  '/src/features/sharing/shareModel.ts',
);
const { rememberShareNotice, currentShareKind } = await vite.ssrLoadModule(
  '/src/features/sharing/shareNotice.ts',
);
const room = {
  roomId: 'room-a',
  title: '가을 모임',
  phase: 'WAITING_FOR_DEPARTURE',
  startedAt: '2026-11-20T00:00:00Z',
  serverNow: '2026-11-20T01:00:00Z',
  me: { role: 'HOST', participantId: 'host-a' },
  allowedActions: [],
  joinedCount: 3,
  capacity: 4,
  dates: { from: '2026-11-22', through: '2026-11-24' },
  inputProgress: { completedCount: 2, capacity: 4 },
  invite: {
    code: 'ABC123',
    inviteUrl: 'https://meetdle.co.kr/invite/token',
    expiresAt: '2026-11-22T00:00:00Z',
  },
  registration: {
    round: 2,
    closesAt: '2026-11-20T04:00:00Z',
    progress: { completedCount: 2, capacity: 4 },
  },
  voting: {
    round: 2,
    closesAt: '2026-11-20T05:00:00Z',
    progress: { completedCount: 3, capacity: 4 },
  },
};
const url = 'https://meetdle.co.kr/rooms/current?roomId=room-a';
test('all situations use the approved CTA and current server information', () => {
  const kinds = [
    'invite',
    'inputRequest',
    'inputReminder',
    'hostRequest',
    'meetingConfirmed',
    'meetingChanged',
    'registrationRequest',
    'registrationReminder',
    'votingRequest',
    'votingReminder',
    'finalResult',
    'registrationExtended',
    'votingExtended',
    'registrationRestarted',
  ];
  for (const kind of kinds) {
    const message = buildShareMessage(room, kind, url);
    assert.ok(message.title);
    assert.ok(message.buttonTitle);
    assert.equal(message.url, url);
    assert.ok(message.text.length <= 200);
  }
  const input = buildShareMessage(room, 'inputReminder', url);
  assert.match(input.text, /2 \/ 4명 입력 완료/);
  assert.ok(!input.rows.some((row) => row.label.includes('마감')));
  assert.match(buildShareMessage(room, 'invite', url).text, /ABC123/);
  assert.match(buildShareMessage(room, 'registrationExtended', url).text, /연장됐어요/);
  assert.match(buildShareMessage(room, 'registrationRestarted', url).text, /2회차/);
  assert.equal(sharePurpose('meetingChanged'), null);
});
test('phase, deadline and host notification thresholds prevent stale sharing', () => {
  assert.doesNotThrow(() => assertShareStage(room, 'inputRequest'));
  assert.throws(() => assertShareStage({ ...room, phase: 'VOTING_OPEN' }, 'inputReminder'));
  assert.doesNotThrow(() =>
    assertShareStage({ ...room, phase: 'PLACE_SUBMISSION_OPEN' }, 'registrationReminder'),
  );
  assert.throws(() =>
    assertShareStage(
      { ...room, phase: 'PLACE_SUBMISSION_OPEN', serverNow: room.registration.closesAt },
      'registrationReminder',
    ),
  );
  assert.throws(() => assertShareStage(room, 'hostRequest'));
  assert.doesNotThrow(() => assertShareStage({ ...room, me: { role: 'MEMBER' } }, 'hostRequest'));
  assert.throws(() =>
    assertShareStage(
      { ...room, me: { role: 'MEMBER' }, inputProgress: { completedCount: 1, capacity: 4 } },
      'hostRequest',
    ),
  );
  assert.throws(() =>
    assertShareStage({ ...room, phase: 'RESULT_READY', result: {} }, 'finalResult'),
  );
});
test('final result follows server visit order and Unicode truncation is safe', () => {
  const meeting = {
    meetingAt: '2026-11-22T09:00:00Z',
    endsAt: '2026-11-22T11:00:00Z',
    station: { stationId: 'station', name: '왕십리역' },
  };
  const final = buildShareMessage(
    {
      ...room,
      result: {
        meeting,
        selected: [
          { candidateId: 'a', place: { name: '식당' } },
          { candidateId: 'b', place: { name: '카페' } },
        ],
        visitOrder: ['b', 'a'],
      },
    },
    'finalResult',
    url,
  );
  assert.equal(final.rows.find((row) => row.label === '1번째 장소').value, '카페');
  const long = buildShareMessage({ ...room, title: '😀'.repeat(300) }, 'invite', url);
  assert.ok(long.text.length <= 200);
  assert.ok(!/[\uD800-\uDBFF]…$/.test(long.text));
  assert.throws(() => buildShareMessage(room, 'invite', 'javascript:alert(1)'));
  assert.throws(() => buildShareMessage(room, 'invite', 'https://user:password@example.com'));
});
test('extension and restart notices are scoped to participant, round and deadline', () => {
  const values = new Map();
  globalThis.sessionStorage = {
    setItem: (k, v) => values.set(k, v),
    getItem: (k) => values.get(k) ?? null,
  };
  try {
    const active = { ...room, phase: 'PLACE_SUBMISSION_OPEN' };
    rememberShareNotice(active, {
      kind: 'registrationExtended',
      round: 2,
      closesAt: active.registration.closesAt,
    });
    assert.equal(currentShareKind(active, 'registrationRequest'), 'registrationExtended');
    assert.equal(currentShareKind(active, 'registrationReminder'), 'registrationReminder');
    assert.equal(
      currentShareKind({ ...active, me: { participantId: 'other' } }, 'registrationRequest'),
      'registrationRequest',
    );
    assert.equal(
      currentShareKind(
        { ...active, registration: { ...active.registration, round: 3 } },
        'registrationRequest',
      ),
      'registrationRequest',
    );
    assert.equal(
      currentShareKind({ ...active, phase: 'VOTING_OPEN' }, 'registrationRequest'),
      'registrationRequest',
    );
  } finally {
    delete globalThis.sessionStorage;
  }
});

test('prepared share calls SDK synchronously in the click stack and reports missing SDK', async () => {
  const { openPreparedKakaoShare } = await vite.ssrLoadModule(
    '/src/features/serverRoom/kakaoInviteShare.ts',
  );
  let clickActive = true;
  const payloads = [];
  globalThis.window = {
    Kakao: {
      isInitialized: () => true,
      Share: {
        sendDefault(payload) {
          assert.equal(clickActive, true);
          payloads.push(payload);
        },
      },
    },
  };
  try {
    const returned = openPreparedKakaoShare({
      text: '초대합니다',
      url,
      buttonTitle: '초대 확인하기',
    });
    clickActive = false;
    assert.equal(returned, undefined);
    assert.equal(payloads.length, 1);
    assert.equal(payloads[0].buttonTitle, '초대 확인하기');
    assert.equal(payloads[0].link.mobileWebUrl, url);
    globalThis.window = {};
    assert.throws(() => openPreparedKakaoShare({ text: '초대', url, buttonTitle: '확인' }), /준비/);
  } finally {
    delete globalThis.window;
  }
});
