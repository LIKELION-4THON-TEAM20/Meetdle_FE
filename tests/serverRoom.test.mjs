import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const id = '01234567-89ab-4cde-8f01-23456789abcd';
const otherId = 'abcd4567-89ab-4cde-8f01-23456789abcd';
const token = 'a'.repeat(43);
const session = { user: { userId: id, nickname: 'Host' }, csrfToken: 'fixture-csrf' };
const preview = { roomId: id, title: 'Dinner', entryStatus: 'OPEN' };
const proof = { preview, joinProof: 'fixture-proof', joinProofExpiresAt: '2099-01-01T00:00:00Z' };
const dto = (roomId = id, revision = 3) => ({
  roomId,
  revision,
  title: 'Dinner',
  phase: 'WAITING_FOR_DEPARTURE',
  me: { role: 'HOST' },
  allowedActions: ['START_ROOM'],
  serverNow: '2026-11-19T12:00:00Z',
});
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

let responder;
const realFetch = globalThis.fetch;
globalThis.fetch = (...args) => responder(...args);
const vite = await createServer({
  envDir: false,
  define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('https://example.test') },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
});
after(async () => {
  globalThis.fetch = realFetch;
  await vite.close();
});
const { api, createApiClient, ApiRequestError } = await vite.ssrLoadModule('/src/api/client.ts');
const { createRoomStateStore, estimateServerNow } = await vite.ssrLoadModule(
  '/src/features/serverRoom/roomState.ts',
);
const { roomScreen, shouldPollRoom, createdRoomDestination, serverRoomUrl } =
  await vite.ssrLoadModule('/src/features/serverRoom/routing.ts');
const { invitationError, loadInvitation, resolveInvitationCode, joinResolvedInvitation } =
  await vite.ssrLoadModule('/src/features/serverRoom/invitation.ts');

test('RoomState has loading, joins identical reads, and isolates room switches and late replies', async () => {
  const first = deferred();
  const second = deferred();
  const signals = [];
  let readCount = 0;
  const client = createApiClient('https://example.test', async () => Response.json(session));
  const store = createRoomStateStore(
    id,
    (_, signal) => {
      signals.push(signal);
      return [first, second][readCount++].promise;
    },
    client,
  );
  const stop = store.connect();
  const initial = store.refresh();
  assert.equal(initial, store.refresh());
  assert.equal(store.getSnapshot().loading, true);
  await new Promise(setImmediate);
  const fresh = store.refresh({ replace: true, checkSession: false });
  second.resolve(dto(id, 5));
  await fresh;
  assert.equal(signals[0].aborted, true);
  first.resolve(dto(id, 2));
  await initial;
  assert.equal(store.getSnapshot().room.revision, 5);
  const other = createRoomStateStore(otherId, async () => dto(otherId), client);
  stop();
  assert.equal(store.getSnapshot().room, null);
  await other.refresh();
  assert.equal(other.getSnapshot().room.roomId, otherId);
});

test('RoomState clears on session change, distinguishes errors, and refreshes on mutation conflict', async () => {
  let credentials = session;
  let reads = 0;
  let readError;
  const client = createApiClient('https://example.test', async () => Response.json(credentials));
  const store = createRoomStateStore(
    id,
    async () => {
      if (readError) throw readError;
      return dto(id, ++reads);
    },
    client,
  );
  const stop = store.connect();
  await store.refresh();
  await assert.rejects(
    store.mutate('CONFIRM_RESULT', async () => {}),
    /unavailable/,
  );
  const conflict = new ApiRequestError(409, { code: 'STALE_ROOM', message: 'Conflict' });
  const change = store.mutate('START_ROOM', async () => {
    throw conflict;
  });
  assert.equal(
    change,
    store.mutate('START_ROOM', async () => assert.fail('duplicate')),
  );
  await assert.rejects(change, (error) => error === conflict);
  assert.equal(store.getSnapshot().room.revision, 2);
  assert.ok(store.getSnapshot().notice);
  await store.mutate('START_ROOM', async () => 'success');
  assert.equal(store.getSnapshot().room.revision, 3);
  credentials = { ...session, csrfToken: 'new-csrf' };
  const changed = deferred();
  const disconnect = store.subscribe(() => {
    if (store.getSnapshot().room?.revision === 4) changed.resolve();
  });
  await client.getSession({ refresh: true });
  await changed.promise;
  disconnect();
  assert.equal(store.getSnapshot().room.revision, 4);
  for (const [status, code] of [
    [null, 'NETWORK_ERROR'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
  ]) {
    readError = new ApiRequestError(status, { code, message: code });
    await store.refresh({ checkSession: false });
    assert.equal(store.getSnapshot().error.code, code);
    if (status) assert.equal(store.getSnapshot().room, null);
  }
  client.clearSession();
  assert.equal(store.getSnapshot().room, null);
  assert.equal(store.getSnapshot().error.status, 401);
  stop();
});

test('server routes use role and allowedActions and never route mock IDs through the client contract', () => {
  const room = dto();
  assert.equal(roomScreen(room), '/rooms/recruitment');
  assert.equal(
    roomScreen({ ...room, me: { role: 'MEMBER' }, allowedActions: ['EDIT_INPUT'] }),
    '/rooms/schedule-transit',
  );
  assert.equal(
    roomScreen({ ...room, phase: 'OPTIONS_READY', me: { role: 'MEMBER' } }),
    '/rooms/participation-status',
  );
  for (const phase of [
    'WAITING_FOR_HOST_DECISION',
    'RESULT_READY',
    'FINAL_PLACE_CONFIRMED',
    'RECOVERY_REQUIRED',
    'ENDED',
  ]) {
    assert.equal(roomScreen({ ...room, phase }), '/rooms/vote/result');
  }
  assert.equal(
    shouldPollRoom({ ...room, phase: 'VOTING_OPEN', allowedActions: ['EDIT_PREFERENCES'] }),
    false,
  );
  assert.equal(shouldPollRoom({ ...room, phase: 'VOTING_OPEN', allowedActions: [] }), true);
  assert.equal(shouldPollRoom({ ...room, phase: 'RESULT_READY' }), false);
  assert.throws(() => serverRoomUrl('mock-room-10-14'), /Invalid/);
  const response = { roomId: id, invite: { code: 'ABC123' } };
  assert.deepEqual(createdRoomDestination(response), {
    to: '/rooms/create/complete?mode=api&roomId=' + id,
    state: { createdRoom: response },
  });
  assert.equal(estimateServerNow(room, 1000, 3500), Date.parse(room.serverNow) + 2500);
});

test('A06 is public after A03 401, then A25 and A07 use separate authenticated writes', async () => {
  let loggedIn = false;
  const requests = [];
  responder = async (url, options) => {
    requests.push([url.pathname, options]);
    if (url.pathname === '/api/me')
      return loggedIn
        ? Response.json(session)
        : Response.json({ code: 'UNAUTHENTICATED', message: 'Login' }, { status: 401 });
    if (url.pathname === '/api/invitations/' + token) return Response.json(preview);
    if (url.pathname === '/api/invitations/resolve') return Response.json(proof);
    if (url.pathname === '/api/rooms/' + id + '/join')
      return Response.json({ roomId: id }, { status: 201 });
    assert.fail('unexpected request');
  };
  const signal = new AbortController().signal;
  assert.deepEqual(await loadInvitation(token, signal), { session: null, preview });
  loggedIn = true;
  assert.deepEqual(await loadInvitation(token, signal), { session, preview });
  assert.deepEqual(await resolveInvitationCode(token, id, ' abC123 '), proof);
  const writes = () => requests.filter(([, options]) => options.method === 'POST');
  assert.equal(writes().length, 1);
  assert.deepEqual(JSON.parse(writes()[0][1].body), { code: 'ABC123', inviteToken: token });
  await assert.rejects(
    joinResolvedInvitation({ ...proof, joinProofExpiresAt: '2000-01-01T00:00:00Z' }, session),
    (error) => error.code === 'JOIN_PROOF_EXPIRED',
  );
  assert.equal(writes().length, 1);
  assert.equal(await joinResolvedInvitation(proof, session), id);
  assert.deepEqual(JSON.parse(writes()[1][1].body), { joinProof: proof.joinProof });
  assert.equal(writes()[1][1].headers['X-CSRF-TOKEN'], session.csrfToken);
  assert.equal(writes()[1][1].credentials, 'include');
  api.clearSession();
});

test('invitation maps preview, code, capacity, closed, expiry, rate limit and network errors', async () => {
  responder = async (url) =>
    url.pathname === '/api/me'
      ? Response.json(session)
      : Response.json({ code: 'INVITATION_NOT_FOUND', message: 'Not found' }, { status: 404 });
  await assert.rejects(loadInvitation(token, new AbortController().signal), (error) => {
    assert.match(invitationError(error, 'preview'), /링크/);
    return error.status === 404;
  });
  for (const [status, code, step, message] of [
    [404, 'INVALID_INVITATION', 'code', /일치/],
    [410, 'INVITATION_EXPIRED', 'join', /다시 확인/],
    [409, 'ROOM_FULL', 'join', /정원/],
    [409, 'JOIN_CLOSED', 'join', /마감/],
    [429, 'RATE_LIMITED', 'code', /20초/],
    [null, 'NETWORK_ERROR', 'preview', /연결/],
  ]) {
    const error = new ApiRequestError(status, {
      code,
      message: code,
      details: { retryAfterSeconds: 20 },
    });
    assert.match(invitationError(error, step), message);
  }
});

test('SCREEN 04 separates roster and input progress and applies server role and action gates', async () => {
  const { participationModel } = await vite.ssrLoadModule(
    '/src/pages/ParticipationStatus/serverParticipationModel.ts',
  );
  const { roomScreenForEntry, serverScreenUrl } = await vite.ssrLoadModule(
    '/src/features/serverRoom/routing.ts',
  );
  const room = {
    ...dto(),
    startedAt: null,
    joinedCount: 2,
    capacity: 4,
    inputProgress: { completedCount: 1, capacity: 4 },
    me: { role: 'HOST', participantId: 'host' },
    members: [
      { participantId: 'host', nickname: 'Host', role: 'HOST', inputComplete: true },
      { participantId: 'member', nickname: 'Member', role: 'MEMBER', inputStatus: 'IN_PROGRESS' },
    ],
    allowedActions: ['START_ROOM', 'CALCULATE_OPTIONS'],
  };
  const model = participationModel(room);
  assert.equal(model.canStart, true);
  assert.equal(model.canCalculate, false);
  assert.equal(model.completed, 1);
  assert.equal(model.participants.length, 2);
  assert.equal(model.incomplete[0].status, 'inProgress');
  assert.equal(model.canRemind, true);
  const member = { ...room, me: { role: 'MEMBER', participantId: 'member' } };
  assert.equal(participationModel(member).canStart, false);
  assert.equal(participationModel(member).canNotifyHost, false);
  assert.equal(roomScreenForEntry(member), '/rooms/recruitment');
  assert.equal(
    roomScreenForEntry(
      { ...member, startedAt: '2026-11-19T12:00:00Z', allowedActions: ['EDIT_INPUT'] },
      '/rooms/participation-status',
    ),
    '/rooms/participation-status',
  );
  assert.equal(serverScreenUrl('/rooms/candidates', id), '/rooms/candidates?mode=api&roomId=' + id);
});

test('SCREEN 04 refreshes stale A31 and reuses the A11 key on a lost response', async () => {
  const { createParticipationCommands, participationError } = await vite.ssrLoadModule(
    '/src/pages/ParticipationStatus/serverParticipationModel.ts',
  );
  let room = {
    ...dto(),
    joinedCount: 2,
    capacity: 4,
    inputProgress: { completedCount: 2, capacity: 4 },
    inputVersion: 7,
  };
  const writes = [];
  responder = async (url, options) => {
    if (url.pathname === '/api/me') return Response.json(session);
    if (url.pathname.endsWith('/state')) return Response.json(room);
    writes.push({
      path: url.pathname,
      body: JSON.parse(options.body),
      key: options.headers['Idempotency-Key'],
    });
    if (url.pathname.endsWith('/start')) {
      if (room.revision === 3) {
        room = { ...room, revision: 4 };
        return Response.json({ code: 'STALE_ROOM', message: 'Conflict' }, { status: 409 });
      }
      room = {
        ...room,
        revision: 5,
        startedAt: '2026-11-19T12:00:00Z',
        capacity: 2,
        allowedActions: ['CALCULATE_OPTIONS'],
      };
      return new Response(null, { status: 204 });
    }
    if (writes.length === 3) throw new TypeError('lost response');
    room = {
      ...room,
      revision: 6,
      phase: 'OPTIONS_READY',
      options: { optionsId: otherId },
      allowedActions: [],
    };
    return Response.json(room.options, { status: 201 });
  };
  const store = createRoomStateStore(id);
  const stop = store.connect();
  try {
    await store.refresh();
    const commands = createParticipationCommands();
    await assert.rejects(store.mutate('START_ROOM', commands.start), (error) => {
      assert.match(participationError(error), /최신 참여/);
      return error.code === 'STALE_ROOM';
    });
    assert.equal(store.getSnapshot().room.revision, 4);
    await store.mutate('START_ROOM', commands.start);
    assert.equal(store.getSnapshot().room.capacity, 2);
    const calculate = store.mutate('CALCULATE_OPTIONS', commands.calculate);
    assert.equal(calculate, store.mutate('CALCULATE_OPTIONS', commands.calculate));
    await assert.rejects(calculate, (error) => error.code === 'NETWORK_ERROR');
    await store.mutate('CALCULATE_OPTIONS', commands.calculate);
    assert.equal(store.getSnapshot().room.phase, 'OPTIONS_READY');
    assert.deepEqual(
      writes.map(({ body }) => body),
      [{ expectedRevision: 3 }, { expectedRevision: 4 }, { inputVersion: 7 }, { inputVersion: 7 }],
    );
    assert.ok(writes[2].key);
    assert.equal(writes[2].key, writes[3].key);
  } finally {
    stop();
    api.clearSession();
  }
});
