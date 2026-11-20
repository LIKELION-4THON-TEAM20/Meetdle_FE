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
const { roomScreen, roomScreenForEntry, shouldPollRoom, createdRoomDestination, serverRoomUrl } =
  await vite.ssrLoadModule('/src/features/serverRoom/routing.ts');
const { ballotPermissions, ballotSelections, voteDecisionPermissions, voteExtensionRange } =
  await vite.ssrLoadModule('/src/features/serverRoom/voting.ts');
const { roomMutations, getRoomShare } = await vite.ssrLoadModule('/src/api/rooms.ts');
const { resultPermissions, tieChoices, validVisitOrder } = await vite.ssrLoadModule(
  '/src/features/serverRoom/result.ts',
);
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
  await client.getSession({ refresh: true });
  assert.equal(store.getSnapshot().room.revision, 2);
  assert.equal(reads, 2);
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
  assert.equal(roomScreen({ ...room, joinedCount: 1 }), '/rooms/create/complete');
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
    shouldPollRoom({
      ...room,
      phase: 'VOTING_OPEN',
      me: { ...room.me, canVote: true },
      allowedActions: ['EDIT_PREFERENCES'],
    }),
    true,
  );
  assert.equal(shouldPollRoom({ ...room, phase: 'VOTING_OPEN', allowedActions: [] }), true);
  assert.equal(shouldPollRoom({ ...room, phase: 'RESULT_READY', result: {} }), false);
  assert.equal(shouldPollRoom({ ...room, phase: 'RESULT_READY', me: { role: 'MEMBER' } }), true);
  assert.throws(() => serverRoomUrl('mock-room-10-14'), /Invalid/);
  const response = { roomId: id, invite: { code: 'ABC123' } };
  assert.deepEqual(createdRoomDestination(response), {
    to: '/rooms/create/complete?mode=api&roomId=' + id,
    state: { createdRoom: response },
  });
  assert.equal(estimateServerNow(room, 1000, 3500), Date.parse(room.serverNow) + 2500);
});

test('A08 ballot restores eligible preferences and routes a submitted member to status', () => {
  const room = {
    ...dto(),
    phase: 'VOTING_OPEN',
    me: { role: 'MEMBER', participantId: 'me', canVote: true },
    allowedActions: ['EDIT_PREFERENCES', 'SUBMIT_VOTE'],
    voting: {
      round: 2,
      closesAt: '2026-11-19T13:00:00Z',
      completion: [],
      candidates: [
        { candidateId: 'food', mode: 'VOTE' },
        { candidateId: 'optional', mode: 'VOTE' },
        { candidateId: 'auto', mode: 'AUTO_SELECTED' },
      ],
    },
  };
  const saved = [
    { candidateId: 'food', choice: 'LIKE' },
    { candidateId: 'auto', choice: 'LIKE' },
    { candidateId: 'removed', choice: 'LIKE' },
  ];
  assert.equal(ballotSelections(room, saved, []).complete, false);
  assert.deepEqual(
    ballotSelections(room, saved, [
      { candidateId: 'food', choice: 'DISLIKE' },
      { candidateId: 'optional', choice: 'NEUTRAL' },
    ]),
    {
      total: 2,
      complete: true,
      selections: [
        { candidateId: 'food', choice: 'DISLIKE' },
        { candidateId: 'optional', choice: 'NEUTRAL' },
      ],
    },
  );
  assert.deepEqual(ballotPermissions(room, Date.parse(room.serverNow)), {
    edit: true,
    submit: true,
  });
  assert.deepEqual(ballotPermissions(room, Date.parse(room.voting.closesAt)), {
    edit: false,
    submit: false,
  });
  assert.equal(roomScreenForEntry(room, '/rooms/vote/status'), '/rooms/vote/status');
  assert.equal(roomScreen(room), '/rooms/vote');
  room.voting.completion.push({ participantId: 'me', completed: true });
  assert.equal(roomScreen(room), '/rooms/vote/status');
});

test('A27 permissions require server review, host, and a submitted ballot for PROCEED', () => {
  const room = {
    ...dto(),
    phase: 'VOTE_REVIEW_REQUIRED',
    allowedActions: ['EXTEND_VOTE', 'PROCEED_WITH_VOTES'],
    voting: { closesAt: '2026-11-19T12:00:00Z' },
    voteReview: { canExtend: true, canProceed: true, progress: { completedCount: 0 } },
    deadlinePolicy: { votingCutoff: '2026-11-19T13:00:00Z' },
  };
  assert.deepEqual(voteDecisionPermissions(room), { extend: true, proceed: false });
  room.voteReview.progress.completedCount++;
  assert.deepEqual(voteDecisionPermissions(room), { extend: true, proceed: true });
  room.voteReview.canExtend = false;
  assert.deepEqual(voteDecisionPermissions(room), { extend: false, proceed: true });
  assert.deepEqual(voteDecisionPermissions({ ...room, me: { role: 'MEMBER' } }), {
    extend: false,
    proceed: false,
  });
  assert.deepEqual(voteDecisionPermissions({ ...room, phase: 'VOTING_OPEN' }), {
    extend: false,
    proceed: false,
  });
  assert.deepEqual(voteExtensionRange(room, Date.parse(room.serverNow)), {
    minimum: Date.parse(room.voting.closesAt) + 1,
    maximum: Date.parse(room.deadlinePolicy.votingCutoff),
  });
});

test('voting writes use the saved draft revision and apply a reusable key only to EXTEND', async () => {
  api.clearSession();
  const calls = [];
  let failExtension = true;
  responder = async (url, options) => {
    if (url.pathname === '/api/me') return Response.json(session);
    calls.push({
      path: url.pathname.split(id)[1],
      purpose: url.searchParams.get('purpose'),
      method: options.method ?? 'GET',
      key: new Headers(options.headers).get('Idempotency-Key'),
      body: options.body && JSON.parse(options.body),
    });
    if (url.pathname.endsWith('/preferences/me'))
      return Response.json({ draftRevision: 4, selections: [], submitted: false });
    if (url.pathname.endsWith('/share'))
      return Response.json({ purpose: url.searchParams.get('purpose') });
    if (calls.at(-1).body?.action === 'EXTEND' && failExtension) {
      failExtension = false;
      throw new TypeError('Connection interrupted');
    }
    return new Response(null, { status: 204 });
  };
  const draft = await roomMutations
    .savePreferences(id, { round: 2, draftRevision: 3, selections: [] })
    .execute();
  await roomMutations.submitVote(id, { round: 2, draftRevision: draft.draftRevision }).execute();
  const extend = roomMutations.decideVote(id, {
    round: 2,
    action: 'EXTEND',
    closesAt: '2026-11-19T13:00:00Z',
  });
  await assert.rejects(extend.execute(), { code: 'NETWORK_ERROR' });
  await extend.execute();
  await roomMutations.decideVote(id, { round: 2, action: 'PROCEED' }).execute();
  await getRoomShare(id, 'VOTING');
  await getRoomShare(id, 'HOST');
  assert.deepEqual(
    calls.map(({ path, method }) => [path, method]),
    [
      ['/preferences/me', 'PUT'],
      ['/vote-submissions/me', 'PUT'],
      ['/voting/decision', 'POST'],
      ['/voting/decision', 'POST'],
      ['/voting/decision', 'POST'],
      ['/share', 'GET'],
      ['/share', 'GET'],
    ],
  );
  assert.deepEqual(calls[1].body, { round: 2, draftRevision: 4 });
  assert.equal(calls[0].key, null);
  assert.equal(calls[1].key, null);
  assert.match(calls[2].key, /^[0-9a-f-]{36}$/);
  assert.equal(calls[2].key, calls[3].key);
  assert.deepEqual(calls[4].body, { round: 2, action: 'PROCEED' });
  assert.equal(calls[4].key, null);
  assert.deepEqual(
    calls.slice(5).map(({ purpose }) => purpose),
    ['VOTING', 'HOST'],
  );
  api.clearSession();
});

test('result controls follow phase, role, server actions, time and complete candidate IDs', () => {
  const room = {
    ...dto(),
    me: { role: 'HOST' },
    phase: 'RESULT_READY',
    allowedActions: ['REORDER_VISIT', 'CONFIRM_RESULT', 'RESOLVE_TIES', 'RECOLLECT'],
    meeting: { meetingAt: '2026-11-20T12:00:00Z' },
    result: {
      round: 3,
      resultRevision: 4,
      confirmed: false,
      meeting: { meetingAt: '2026-11-20T12:00:00Z' },
      selected: [{ candidateId: 'a' }, { candidateId: 'b' }],
      visitOrder: ['a', 'b'],
    },
  };
  const now = Date.parse(room.serverNow);
  assert.deepEqual(resultPermissions(room, now), {
    finalized: false,
    tie: false,
    order: true,
    confirm: true,
    recover: false,
  });
  assert.equal(validVisitOrder(room, ['b', 'a']), true);
  for (const invalid of [['a'], ['a', 'a'], ['a', 'c']])
    assert.equal(validVisitOrder(room, invalid), false);
  const member = { ...room, me: { role: 'MEMBER' } };
  assert.equal(resultPermissions(member, now).confirm, false);
  assert.equal(resultPermissions(member, now).order, false);
  const tied = {
    ...room,
    phase: 'WAITING_FOR_HOST_DECISION',
    tieDecision: {
      groups: [
        { category: 'FOOD', places: [{ candidateId: 'a' }] },
        { category: 'CAFE', places: [{ candidateId: 'b' }] },
      ],
    },
  };
  assert.equal(tieChoices(tied, { FOOD: 'a' }), null);
  assert.equal(tieChoices(tied, { FOOD: 'b', CAFE: 'a' }), null);
  assert.deepEqual(tieChoices(tied, { FOOD: 'a', CAFE: 'b' }), [
    { category: 'FOOD', candidateId: 'a' },
    { category: 'CAFE', candidateId: 'b' },
  ]);
  assert.equal(resultPermissions(tied, now).confirm, false);
  assert.equal(resultPermissions(tied, now).order, true);
  const final = {
    ...room,
    phase: 'FINAL_PLACE_CONFIRMED',
    result: { ...room.result, confirmed: true },
  };
  assert.equal(resultPermissions(final, now + 172800000).order, true);
  assert.equal(resultPermissions(final, now).confirm, false);
  const recovery = {
    ...room,
    phase: 'RECOVERY_REQUIRED',
    recovery: { reason: 'NO_ELIGIBLE_RESULT' },
  };
  assert.equal(resultPermissions(recovery, now).recover, true);
  assert.equal(resultPermissions(recovery, Date.parse(room.meeting.meetingAt)).recover, false);
  assert.equal(
    resultPermissions({ ...recovery, recovery: { reason: 'RETRY_EXHAUSTED' } }, now).recover,
    false,
  );
});

test('result mutations wire tie, order, confirmation and keyed recovery independently', async () => {
  api.clearSession();
  const calls = [];
  let failRecovery = true;
  responder = async (url, options) => {
    if (url.pathname === '/api/me') return Response.json(session);
    const path = url.pathname.split(id)[1];
    const body = options.body && JSON.parse(options.body);
    calls.push({ path, body, key: new Headers(options.headers).get('Idempotency-Key') });
    if (path === '/recovery') {
      if (failRecovery) {
        failRecovery = false;
        throw new TypeError('Connection interrupted');
      }
      return Response.json({ round: 4, closesAt: body.closesAt }, { status: 201 });
    }
    if (path === '/share') return Response.json({ purpose: url.searchParams.get('purpose') });
    return new Response(null, { status: 204 });
  };
  const version = { round: 3, resultRevision: 4 };
  await roomMutations
    .resolveTies(id, { ...version, choices: [{ category: 'FOOD', candidateId: 'a' }] })
    .execute();
  await roomMutations
    .reorderVisit(id, { ...version, resultRevision: 5, candidateIds: ['b', 'a'] })
    .execute();
  await roomMutations.confirmResult(id, { ...version, resultRevision: 6 }).execute();
  assert.equal((await getRoomShare(id, 'RESULT')).purpose, 'RESULT');
  const recovery = roomMutations.recollect(id, { round: 3, closesAt: '2026-11-19T17:00:00Z' });
  await assert.rejects(recovery.execute(), { code: 'NETWORK_ERROR' });
  assert.equal((await recovery.execute()).round, 4);
  assert.deepEqual(
    calls.map(({ path }) => path),
    [
      '/result/selections',
      '/result/visit-order',
      '/result/confirmation',
      '/share',
      '/recovery',
      '/recovery',
    ],
  );
  assert.deepEqual(calls[2].body, { round: 3, resultRevision: 6 });
  assert.ok(calls.slice(0, 4).every(({ key }) => key === null));
  assert.match(calls[4].key, /^[0-9a-f-]{36}$/);
  assert.equal(calls[4].key, calls[5].key);
  api.clearSession();
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
    '/rooms/schedule-transit',
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

test('호스트 혼자이면 초대 화면, 실제 참여자가 한 명 이상 들어오면 입력 현황을 표시한다', () => {
  const solo = {
    ...dto(),
    startedAt: null,
    joinedCount: 1,
    capacity: 6,
    allowedActions: ['EDIT_INPUT'],
  };
  assert.equal(roomScreen(solo), '/rooms/create/complete');
  assert.equal(roomScreenForEntry(solo, '/rooms/participation-status'), '/rooms/create/complete');
  assert.equal(shouldPollRoom(solo), true);
  const joined = { ...solo, joinedCount: 2 };
  assert.equal(roomScreen(joined), '/rooms/participation-status');
  assert.equal(roomScreenForEntry(joined, '/rooms/recruitment'), '/rooms/participation-status');
  assert.equal(
    roomScreen({ ...solo, startedAt: '2026-11-20T00:00:00Z' }),
    '/rooms/schedule-transit',
  );
  assert.equal(roomScreen({ ...joined, phase: 'OPTIONS_READY' }), '/rooms/candidates');
});

test('모집 중 정원을 유지하고 다른 참여자가 합류한 뒤에만 시작할 수 있다', async () => {
  const { participationModel } = await vite.ssrLoadModule(
    '/src/pages/ParticipationStatus/serverParticipationModel.ts',
  );
  for (const joinedCount of [1, 2, 3, 4]) {
    const room = {
      ...dto(),
      inputProgress: { completedCount: 0, capacity: 4 },
      startedAt: null,
      capacity: 4,
      joinedCount,
      allowedActions: ['START_ROOM'],
    };
    assert.equal(participationModel(room).canStart, joinedCount >= 2);
    assert.equal(room.capacity, 4);
  }
  assert.equal(
    participationModel({
      ...dto(),
      inputProgress: { completedCount: 0, capacity: 4 },
      capacity: 4,
      joinedCount: 2,
      allowedActions: [],
    }).canStart,
    false,
  );
});

test('시작 후 호스트와 참여자는 미제출이면 입력 화면, 제출 완료이면 현황으로 이동한다', () => {
  for (const role of ['HOST', 'MEMBER']) {
    const room = {
      ...dto(),
      startedAt: '2026-11-20T00:00:00Z',
      joinedCount: 4,
      me: { role, participantId: 'me' },
      allowedActions: ['COMPLETE_INPUT'],
      myInput: { completedAt: null },
      members: [{ participantId: 'me', inputComplete: false }],
    };
    assert.equal(
      roomScreenForEntry(room, '/rooms/participation-status'),
      '/rooms/schedule-transit',
    );
    assert.equal(
      roomScreenForEntry(
        { ...room, myInput: { completedAt: '2026-11-20T00:01:00Z' } },
        '/rooms/participation-status',
      ),
      '/rooms/participation-status',
    );
  }
});

test('정원별 입력 기준과 전원 완료에 따라 계산·알림·재촉을 구분한다', async () => {
  const { participationModel } = await vite.ssrLoadModule(
    '/src/pages/ParticipationStatus/serverParticipationModel.ts',
  );
  for (const capacity of [2, 3, 4, 5, 6]) {
    const required = Math.max(2, Math.ceil(capacity / 2));
    for (const completed of [required - 1, required, capacity]) {
      const room = {
        ...dto(),
        joinedCount: capacity,
        capacity,
        inputProgress: { completedCount: completed, capacity },
        me: { role: 'HOST', participantId: 'p0' },
        members: Array.from({ length: capacity }, (_, i) => ({
          participantId: 'p' + i,
          nickname: '이름' + i,
          role: i ? 'MEMBER' : 'HOST',
          inputComplete: i < completed,
        })),
        allowedActions: ['CALCULATE_OPTIONS'],
      };
      const model = participationModel(room);
      assert.equal(model.requiredInputs, required);
      assert.equal(model.canCalculate, completed >= required);
      assert.equal(model.allCompleted, completed === capacity);
      assert.equal(model.canRemind, completed < capacity);
      assert.equal(
        participationModel({ ...room, me: { role: 'MEMBER', participantId: 'p1' } }).canNotifyHost,
        completed >= required,
      );
    }
  }
});
