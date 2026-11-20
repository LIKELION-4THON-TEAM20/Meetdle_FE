import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const vite = await createServer({
  envDir: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
});
after(() => vite.close());
const { meetingDetails, meetingActions, meetingShareText } = await vite.ssrLoadModule(
  '/src/features/serverRoom/meeting.ts',
);
const { roomScreenForEntry, serverScreenUrl } = await vite.ssrLoadModule(
  '/src/features/serverRoom/routing.ts',
);

const roomId = '01234567-89ab-4cde-8f01-23456789abcd';
const meeting = {
  selectionId: 'current-selection',
  station: { stationId: 'station-a', name: '서울역' },
  meetingAt: '2026-11-19T14:30:00Z',
  endsAt: '2026-11-19T15:30:00Z',
};
const host = {
  roomId,
  title: '모임',
  joinedCount: 3,
  meeting,
  phase: 'REGION_CONFIRMED',
  serverNow: '2026-11-19T00:00:00Z',
  shareUrl: 'https://example.test/rooms/' + roomId,
  me: { role: 'HOST', canRegister: false },
  allowedActions: ['OPEN_COLLECTION', 'SELECT_MEETING'],
};

test('formats confirmed instants in Seoul across midnight and only uses matching server statistics', () => {
  const view = meetingDetails({
    ...host,
    options: {
      regions: [
        { station: { stationId: 'other' }, meanMinutes: 99 },
        { station: meeting.station, meanMinutes: 24, maxMinutes: 31, meanTransfers: 0 },
      ],
      slots: [
        { meetingAt: '2026-11-19T23:30:00+09:00', endsAt: meeting.endsAt, availableCount: 2 },
      ],
    },
  });
  assert.match(view.dateTime, /11월 19일.*23:30–11월 20일.*00:30/);
  assert.equal(view.area, '서울역');
  assert.equal(view.availableCount, 2);
  assert.equal(view.averageTravelMinutes, 24);
  assert.equal(view.averageTransfers, 0);
  assert.equal(meetingDetails(host).averageTravelMinutes, undefined);
  assert.equal(meetingDetails({ ...host, meeting: null }), null);
});

test('host setup and reselection require the current server phase and corresponding actions', () => {
  assert.equal(roomScreenForEntry(host), '/rooms/confirmed');
  assert.equal(roomScreenForEntry(host, '/rooms/candidates'), '/rooms/candidates');
  assert.equal(roomScreenForEntry(host, '/rooms/registration/setup'), '/rooms/registration/setup');
  assert.equal(meetingActions({ ...host, allowedActions: [] }).canSetup, false);
  const member = { ...host, me: { role: 'MEMBER' } };
  assert.equal(roomScreenForEntry(member, '/rooms/confirmed'), '/rooms/confirmed');
  assert.equal(meetingActions(member).canReselect, false);
  assert.match(
    serverScreenUrl('/rooms/registration/setup', roomId, meeting.selectionId),
    /selectionId=current-selection/,
  );
});

test('registration links use server eligibility, personal completion, and deadline', () => {
  const member = {
    ...host,
    phase: 'PLACE_SUBMISSION_OPEN',
    me: { role: 'MEMBER', canRegister: true },
    allowedActions: ['EDIT_NOMINATION', 'SELECT_MEETING'],
    registration: { closesAt: '2026-11-19T01:00:00Z', closedAt: null, myCompleted: false },
  };
  assert.equal(roomScreenForEntry(member), '/rooms/places');
  assert.equal(roomScreenForEntry(member, '/rooms/places'), '/rooms/places');
  assert.equal(meetingActions(member).canReselect, false);
  assert.equal(meetingActions(member, Date.parse(member.registration.closesAt)).canRegister, false);
  assert.equal(
    roomScreenForEntry(
      { ...member, registration: { ...member.registration, myCompleted: true } },
      '/rooms/places',
    ),
    '/rooms/registration/status',
  );
  assert.equal(
    roomScreenForEntry({ ...member, phase: 'PLACE_SUBMISSION_CLOSED' }, '/rooms/info'),
    '/rooms/info',
  );
});

test('meeting sharing uses the A08 link and confirmed data', () => {
  assert.deepEqual(meetingShareText(host), {
    text: '모임\n' + meetingDetails(host).dateTime + '\n서울역',
    url: host.shareUrl,
  });
  assert.equal(meetingShareText({ ...host, shareUrl: 'javascript:alert(1)' }), null);
  assert.equal(meetingShareText({ ...host, shareUrl: null }), null);
});

test('등록 시작 후 확정·공유 화면에 머물지 않고 본인 등록 권한에 맞는 화면으로 이동한다', () => {
  const member = {
    ...host,
    phase: 'PLACE_SUBMISSION_OPEN',
    me: { role: 'MEMBER', canRegister: true },
    allowedActions: ['SEARCH_PLACES', 'EDIT_NOMINATION'],
    registration: { closesAt: '2026-11-19T01:00:00Z', closedAt: null, myCompleted: false },
  };
  for (const path of ['/rooms/confirmed', '/rooms/info']) {
    assert.equal(roomScreenForEntry(member, path), '/rooms/places');
    assert.equal(roomScreenForEntry({ ...member, me: { ...member.me, canRegister: false } }, path), '/rooms/registration/status');
    assert.equal(roomScreenForEntry({ ...member, registration: { ...member.registration, myCompleted: true } }, path), '/rooms/registration/status');
    assert.equal(roomScreenForEntry({ ...member, allowedActions: [] }, path), '/rooms/registration/status');
  }
});

test('확정 화면은 호스트의 등록 시작을 짧은 간격으로 확인한다', async () => {
  const { roomPollingInterval, shouldPollRoom } = await vite.ssrLoadModule('/src/features/serverRoom/routing.ts');
  const member = { ...host, me: { role: 'MEMBER' } };
  assert.equal(shouldPollRoom(member), true);
  assert.equal(roomPollingInterval(member), 3000);
  assert.equal(roomPollingInterval({ ...member, phase: 'PLACE_SUBMISSION_OPEN' }), 15000);
});
