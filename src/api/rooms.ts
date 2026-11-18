import { api } from './client';
import type {
  Category,
  CategoryAvailability,
  CreateRoomRequest,
  CreateRoomResponse,
  Draft,
  ExtendRegistrationRequest,
  InvitePreview,
  JoinRoomRequest,
  Meeting,
  MyInput,
  MyRoomsPage,
  NominationRequest,
  OpenedRegistration,
  OpenRegistrationRequest,
  PlaceSearchResponse,
  PlanningOptions,
  PlanningOptionsRequest,
  RecollectRequest,
  RegistrationRoundRequest,
  ResolvedInvite,
  ResolveInviteRequest,
  ResolveTiesRequest,
  ReorderVisitRequest,
  RoomRef,
  RoomState,
  RoundDeadline,
  SaveMyInputRequest,
  SavePreferencesRequest,
  SelectMeetingRequest,
  StartVotingRequest,
  StationsResponse,
  SubmitVoteRequest,
  VoteDecisionRequest,
} from './types';

export function isServerRoomId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
}

function roomPath(roomId: string, resource: string) {
  if (!isServerRoomId(roomId)) throw new TypeError('Expected a server room UUID');
  return `/api/rooms/${roomId}/${resource}`;
}

export async function getRoomState(roomId: string, signal?: AbortSignal): Promise<RoomState> {
  const state = await api.get<RoomState>(roomPath(roomId, 'state'), { signal });
  if (state?.roomId !== roomId) {
    throw new TypeError('RoomState does not belong to the requested room');
  }
  return state;
}

export function getMyRooms(
  query: { scope?: 'ALL' | 'UPCOMING' | 'PAST'; limit?: number; cursor?: string } = {},
  signal?: AbortSignal,
) {
  return api.get<MyRoomsPage>('/api/rooms', { query, signal });
}

export function getInvitePreview(token: string, signal?: AbortSignal) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new TypeError('Invalid invitation token');
  return api.get<InvitePreview>(`/api/invitations/${token}`, { signal });
}

export function searchStations(query: { q: string; limit?: number }, signal?: AbortSignal) {
  return api.get<StationsResponse>('/api/stations', { query, signal });
}

export function searchPlaces(
  roomId: string,
  query: { category: Category; q?: string; page?: number; bounds?: string },
  signal?: AbortSignal,
) {
  return api.get<PlaceSearchResponse>(roomPath(roomId, 'places/search'), { query, signal });
}

export function getCategoryAvailability(roomId: string, signal?: AbortSignal) {
  return api.get<CategoryAvailability>(roomPath(roomId, 'place-submission/categories'), { signal });
}

// Create one handle per user intent, then reuse its execute() for duplicate clicks or retries.
const withKey = { idempotent: true };

export const roomMutations = {
  create: (body: CreateRoomRequest) =>
    api.createMutation<CreateRoomResponse>('POST', '/api/rooms', body, withKey),
  resolveInvite: (body: ResolveInviteRequest) =>
    api.createMutation<ResolvedInvite>('POST', '/api/invitations/resolve', body),
  join: (roomId: string, body: JoinRoomRequest) =>
    api.createMutation<RoomRef>('POST', roomPath(roomId, 'join'), body),
  saveInput: (roomId: string, body: SaveMyInputRequest) =>
    api.createMutation<MyInput>('PUT', roomPath(roomId, 'inputs/me'), body),
  calculateOptions: (roomId: string, body: PlanningOptionsRequest) =>
    api.createMutation<PlanningOptions>(
      'POST',
      roomPath(roomId, 'planning-options'),
      body,
      withKey,
    ),
  selectMeeting: (roomId: string, body: SelectMeetingRequest) =>
    api.createMutation<Meeting>('PUT', roomPath(roomId, 'meeting-selection'), body),
  openRegistration: (roomId: string, body: OpenRegistrationRequest) =>
    api.createMutation<OpenedRegistration>(
      'POST',
      roomPath(roomId, 'place-submission'),
      body,
      withKey,
    ),
  setNomination: (roomId: string, category: Category, body: NominationRequest) =>
    api.createMutation<void>('PUT', roomPath(roomId, `place-submission/me/${category}`), body),
  completeRegistration: (roomId: string, body: RegistrationRoundRequest) =>
    api.createMutation<void>('PUT', roomPath(roomId, 'place-submission/me/completion'), body),
  closeRegistration: (roomId: string, body: RegistrationRoundRequest) =>
    api.createMutation<void>('PUT', roomPath(roomId, 'place-submission/closure'), body),
  extendRegistration: (roomId: string, body: ExtendRegistrationRequest) =>
    api.createMutation<RoundDeadline>(
      'POST',
      roomPath(roomId, 'place-submission/extension'),
      body,
      withKey,
    ),
  startVoting: (roomId: string, body: StartVotingRequest) =>
    api.createMutation<void>('POST', roomPath(roomId, 'voting'), body, withKey),
  savePreferences: (roomId: string, body: SavePreferencesRequest) =>
    api.createMutation<Draft>('PUT', roomPath(roomId, 'preferences/me'), body),
  submitVote: (roomId: string, body: SubmitVoteRequest) =>
    api.createMutation<void>('PUT', roomPath(roomId, 'vote-submissions/me'), body),
  decideVote: (roomId: string, body: VoteDecisionRequest) =>
    api.createMutation<void>('POST', roomPath(roomId, 'voting/decision'), body, {
      idempotent: body.action === 'EXTEND',
    }),
  recollect: (roomId: string, body: RecollectRequest) =>
    api.createMutation<RoundDeadline>('POST', roomPath(roomId, 'recovery'), body, withKey),
  resolveTies: (roomId: string, body: ResolveTiesRequest) =>
    api.createMutation<void>('PUT', roomPath(roomId, 'result/selections'), body),
  reorderVisit: (roomId: string, body: ReorderVisitRequest) =>
    api.createMutation<void>('PUT', roomPath(roomId, 'result/visit-order'), body),
};
