// Wire DTOs from deployed OpenAPI. Field presence, nullable values and actions
// omitted by OpenAPI are specified in the 1115 API contract.
export type Category = 'FOOD' | 'CAFE' | 'CULTURE' | 'BAR';
export type RoomRole = 'HOST' | 'MEMBER';
export type Phase =
  | 'WAITING_FOR_DEPARTURE'
  | 'OPTIONS_READY'
  | 'REGION_CONFIRMED'
  | 'PLACE_SUBMISSION_OPEN'
  | 'PLACE_SUBMISSION_CLOSED'
  | 'VOTING_OPEN'
  | 'VOTE_REVIEW_REQUIRED'
  | 'WAITING_FOR_HOST_DECISION'
  | 'FINAL_PLACE_CONFIRMED'
  | 'RECOVERY_REQUIRED'
  | 'ENDED';
export type Action =
  | 'EDIT_INPUT'
  | 'COMPLETE_INPUT'
  | 'CALCULATE_OPTIONS'
  | 'SELECT_MEETING'
  | 'OPEN_COLLECTION'
  | 'SEARCH_PLACES'
  | 'EDIT_NOMINATION'
  | 'COMPLETE_COLLECTION'
  | 'CLOSE_COLLECTION'
  | 'START_MINI_TIMER'
  | 'EXTEND_COLLECTION'
  | 'START_VOTING'
  | 'EDIT_PREFERENCES'
  | 'SUBMIT_VOTE'
  | 'EXTEND_VOTE'
  | 'PROCEED_WITH_VOTES'
  | 'RECOLLECT'
  | 'RESOLVE_TIES'
  | 'REORDER_VISIT';
export type ExtendRegistrationRequest = { round: number } & (
  { mode: 'MINI_TIMER'; closesAt?: string } | { mode: 'EXTEND'; closesAt: string }
);
export type VoteDecisionRequest = { round: number } & (
  { action: 'EXTEND'; closesAt: string } | { action: 'PROCEED'; closesAt?: never }
);
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface SubmitVoteRequest {
  round: number;
  draftRevision: number;
}

export interface ReorderVisitRequest {
  round: number;
  resultRevision: number;
  candidateIds: Array<string>;
}

export interface ResolveTiesRequest {
  round: number;
  resultRevision: number;
  choices: Array<TieChoice>;
}

export interface TieChoice {
  category: Category;
  candidateId: string;
}

export interface SavePreferencesRequest {
  round: number;
  draftRevision: number;
  selections: Array<Preference>;
}

export interface Preference {
  candidateId: string;
  choice: 'LIKE' | 'NEUTRAL' | 'DISLIKE';
}

export interface Draft {
  draftRevision: number;
  selections: Array<Preference>;
  submitted: boolean;
}

export interface NominationRequest {
  round: number;
  pickToken: string | null;
}

export interface RegistrationRoundRequest {
  round: number;
}

export interface SelectMeetingRequest {
  optionsId: string;
  slotId: string;
  candidateId: string;
  expectedSelectionId: string | null;
}

export interface Meeting {
  selectionId: string;
  station: Station;
  meetingAt: string;
  endsAt: string;
}

export interface Station {
  stationId: string;
  name: string;
  lines: Array<string>;
  lat: number;
  lng: number;
}

export interface HourSlot {
  date: string;
  hour: number;
}

export interface SaveMyInputRequest {
  originStationId: string | null;
  destinationStationId: string | null;
  slots: Array<HourSlot>;
  inputRevision: number;
  complete: boolean;
}

export interface MyInput {
  originStation: Station | null;
  destinationStation: Station | null;
  slots: Array<HourSlot>;
  inputRevision: number;
  completedAt: string | null;
}

export interface CreateRoomResponse {
  roomId: string;
  invite: Invite;
}

export interface Invite {
  code: string;
  inviteUrl: string;
  expiresAt: string;
}

export interface CreateRoomRequest {
  title?: string | null;
  dates: DateRange;
  capacity: number;
}

export interface DateRange {
  from: string;
  through: string;
}

export interface StartVotingRequest {
  round: number;
  closesAt: string;
}

export interface RecollectRequest {
  round: number;
  closesAt: string;
}

export interface RoundDeadline {
  round: number;
  closesAt: string;
}

export interface PlanningOptions {
  optionsId: string;
  inputVersion: number;
  matrixVersion: string;
  slots: Array<SlotOption>;
  regions: Array<RegionCandidate>;
}

export interface RegionCandidate {
  candidateId: string;
  station: Station;
  meanMinutes: number;
  maxMinutes: number;
  meanTransfers: number;
  reasons: Array<'BALANCED' | 'LOW_TRANSFER'>;
  score: Score;
  travel: Array<Travel>;
}

export interface Score {
  timeSpreadMinutes: number;
  meanTotalTransfers: number;
}

export interface SlotOption {
  slotId: string;
  meetingAt: string;
  endsAt: string;
  availableCount: number;
  unavailableParticipantIds: Array<string>;
}

export interface Travel {
  participantId: string;
  minutes: number;
  transfers: number;
}

export interface PlanningOptionsRequest {
  inputVersion: number;
}

export interface OpenRegistrationRequest {
  selectionId: string;
  requiredCategories: Array<Category>;
  closesAt?: string;
}

export interface CategorySetting {
  category: Category;
  required: boolean;
  available: boolean;
  radiusMeters: number;
}

export interface OpenedRegistration {
  round: number;
  categories: Array<CategorySetting>;
  closesAt: string;
}

export interface JoinRoomRequest {
  joinProof: string;
}

export interface RoomRef {
  roomId: string;
}

export interface ResolveInviteRequest {
  code: string;
  inviteToken?: string;
}

export interface InvitePreview {
  roomId: string;
  title: string | null;
  dates: DateRange;
  hostNickname: string;
  joinedCount: number;
  capacity: number;
  entryStatus: 'OPEN' | 'FULL' | 'CLOSED' | 'MEMBER';
}

export interface ResolvedInvite {
  preview: InvitePreview;
  joinProof: string;
  joinProofExpiresAt: string;
}

export interface StationsResponse {
  items: Array<Station>;
}

export interface MyRoomSummary {
  roomId: string;
  title: string | null;
  dates: DateRange;
  capacity: number;
  joinedCount: number;
  phase: Phase;
  meetingAt: string | null;
  endsAt: string | null;
}

export interface MyRoomsPage {
  items: Array<MyRoomSummary>;
  nextCursor: string | null;
}

export interface Aggregate {
  like: number;
  neutral: number;
  dislike: number;
}

export interface Candidate {
  candidateId: string;
  place: Place;
  mode: 'VOTE' | 'AUTO_SELECTED';
}

export interface CategoryCount {
  category: Category;
  count: number;
}

export interface CompletionEntry {
  participantId: string;
  nickname: string;
  completed: boolean;
}

export interface FinalResult {
  round: number;
  resultRevision: number;
  meeting: Meeting;
  submittedCount: number;
  selected: Array<ResultPlace>;
  details: Array<ResultPlace>;
  visitOrder: Array<string>;
}

export interface MemberStatus {
  participantId: string;
  nickname: string;
  role: RoomRole;
  inputComplete: boolean;
}

export interface MyMember {
  participantId: string;
  role: RoomRole;
  canRegister: boolean;
  canVote: boolean;
}

export interface Place {
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: Category;
  detailUrl: string | null;
}

export interface Progress {
  completedCount: number;
  capacity: number;
}

export interface Recovery {
  round: number;
  reason: 'NO_ELIGIBLE_RESULT' | 'INSUFFICIENT_TIME' | 'RETRY_EXHAUSTED';
}

export interface Registration {
  round: number;
  closesAt: string;
  closedAt: string | null;
  progress: Progress;
  completion: Array<CompletionEntry>;
  categories: Array<CategorySetting>;
  uniqueCandidateCount: number;
  myCompleted: boolean;
  myNominations: Array<Place>;
  categoryCounts: Array<CategoryCount> | null;
}

export interface ResultPlace {
  candidateId: string;
  place: Place;
  aggregate: Aggregate | null;
}

export interface RoomState {
  roomId: string;
  title: string | null;
  dates: DateRange;
  phase: Phase;
  revision: number;
  inputVersion: number;
  serverNow: string;
  joinedCount: number;
  capacity: number;
  inputProgress: Progress;
  me: MyMember;
  members: Array<MemberStatus> | null;
  myInput: MyInput;
  invite: Invite | null;
  options: PlanningOptions | null;
  meeting: Meeting | null;
  registration: Registration | null;
  voting: Voting | null;
  voteReview: VoteReview | null;
  tieDecision: TieDecision | null;
  result: FinalResult | null;
  recovery: Recovery | null;
  allowedActions: Action[];
}

export interface TieDecision {
  round: number;
  resultRevision: number;
  groups: Array<TieGroup>;
}

export interface TieGroup {
  category: Category;
  places: Array<ResultPlace>;
}

export interface VoteReview {
  round: number;
  progress: Progress;
  completion: Array<CompletionEntry>;
  canExtend: boolean;
  canProceed: boolean;
}

export interface Voting {
  round: number;
  closesAt: string;
  progress: Progress;
  completion: Array<CompletionEntry>;
  candidates: Array<Candidate>;
  myDraft: Draft | null;
}

export interface PlaceSearchResponse {
  items: Array<PlaceSearchItem>;
  nextPage: number | null;
  radiusMeters: number;
  expanded: boolean;
  available: boolean;
}

export interface PlaceSearchItem {
  place: Place;
  distanceMeters: number;
  pickToken: string | null;
  registrable: boolean;
}

export interface CategoryAvailability {
  selectionId: string;
  categories: Array<CategorySetting>;
}

export interface SessionUser {
  userId: string;
  nickname: string;
}

export interface SessionResponse {
  user: SessionUser;
  csrfToken: string;
}
