import { api, ApiRequestError } from '../../api/client';
import { getSession } from '../../api/auth';
import { roomMutations, isServerRoomId } from '../../api/rooms';
import type {
  ResolvedInvite,
  InvitePreview,
  SessionResponse,
  RoomRef,
  ResolveInviteRequest,
} from '../../api/types';

type Mutation<T> = { execute: () => Promise<T> };
interface InvitationDependencies {
  getSession: () => Promise<SessionResponse>;
  resolve: (body: ResolveInviteRequest) => Mutation<ResolvedInvite>;
  join: (roomId: string, body: { joinProof: string }) => Mutation<RoomRef>;
  subscribe: (listener: (session: SessionResponse | undefined) => void) => () => void;
  now?: () => number;
}
interface VerifiedInvitation {
  resolved: ResolvedInvite;
  code?: string;
  inviteToken?: string;
  userId: string;
  csrfToken: string;
  joinOperation?: Mutation<RoomRef>;
}
const invalid = () =>
  new ApiRequestError(null, { code: 'INVALID_RESPONSE', message: 'Invalid invitation response.' });
const changed = () =>
  new ApiRequestError(null, { code: 'SESSION_CHANGED', message: 'Invitation session changed.' });

export function assertInvitePreview(value: unknown): asserts value is InvitePreview {
  const preview = value as Partial<InvitePreview> | null;
  if (
    !preview ||
    typeof preview.roomId !== 'string' ||
    !isServerRoomId(preview.roomId) ||
    !preview.dates ||
    typeof preview.dates.from !== 'string' ||
    typeof preview.dates.through !== 'string' ||
    typeof preview.hostNickname !== 'string' ||
    !Number.isInteger(preview.joinedCount) ||
    !Number.isInteger(preview.capacity) ||
    !['OPEN', 'FULL', 'CLOSED', 'MEMBER'].includes(preview.entryStatus ?? '')
  )
    throw invalid();
}

export function createInvitationFlow(deps: InvitationDependencies) {
  const entries = new Map<string, VerifiedInvitation>();
  const tokenReads = new Map<string, Promise<ResolvedInvite>>();
  let identity: string | undefined;
  const now = deps.now ?? Date.now;
  const unsubscribe = deps.subscribe((session) => {
    const next = session ? `${session.user.userId}:${session.csrfToken}` : undefined;
    if (identity !== next || !session) entries.clear();
    identity = next;
  });
  const sameOwner = (entry: VerifiedInvitation, session: SessionResponse) =>
    entry.userId === session.user.userId && entry.csrfToken === session.csrfToken;

  async function resolve(code: string, inviteToken?: string) {
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(normalized))
      throw new ApiRequestError(400, { code: 'INVALID_INVITATION', message: 'Invalid code.' });
    return verify({ code: normalized, ...(inviteToken ? { inviteToken } : {}) });
  }
  async function resolveToken(inviteToken: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(inviteToken))
      throw new ApiRequestError(400, { code: 'INVALID_INVITATION', message: 'Invalid token.' });
    const session = await deps.getSession();
    const key = JSON.stringify([inviteToken, session.user.userId, session.csrfToken]);
    const pending = tokenReads.get(key);
    if (pending) return pending;
    const task = verify({ inviteToken }).finally(() => tokenReads.delete(key));
    tokenReads.set(key, task);
    return task;
  }
  async function verify(body: ResolveInviteRequest) {
    const session = await deps.getSession();
    const result = await deps.resolve(body).execute();
    const current = await deps.getSession();
    if (session.user.userId !== current.user.userId || session.csrfToken !== current.csrfToken)
      throw changed();
    assertInvitePreview(result?.preview);
    entries.set(result.preview.roomId, {
      resolved: result,
      code: body.code,
      inviteToken: body.inviteToken,
      userId: session.user.userId,
      csrfToken: session.csrfToken,
    });
    return result;
  }
  function peek(roomId: string, session: SessionResponse) {
    const entry = entries.get(roomId);
    return entry && sameOwner(entry, session) ? entry.resolved : null;
  }
  async function join(roomId: string) {
    let entry = entries.get(roomId);
    const session = await deps.getSession();
    if (!entry || !sameOwner(entry, session)) throw changed();
    if (entry.resolved.preview.entryStatus === 'MEMBER') return { roomId };
    if (entry.resolved.preview.entryStatus === 'FULL')
      throw new ApiRequestError(409, { code: 'ROOM_FULL', message: 'Room full.' });
    if (entry.resolved.preview.entryStatus === 'CLOSED')
      throw new ApiRequestError(409, { code: 'JOIN_CLOSED', message: 'Join closed.' });
    const expiresAt = Date.parse(entry.resolved.joinProofExpiresAt);
    if (!Number.isFinite(expiresAt)) throw invalid();
    if (expiresAt <= now()) {
      const resolved = entry.code
        ? await resolve(entry.code, entry.inviteToken)
        : await resolveToken(entry.inviteToken!);
      if (resolved.preview.roomId !== roomId) throw invalid();
      entry = entries.get(roomId)!;
      if (entry.resolved.preview.entryStatus !== 'OPEN') return join(roomId);
    }
    if (!entry.resolved.joinProof || Date.parse(entry.resolved.joinProofExpiresAt) <= now())
      throw invalid();
    entry.joinOperation ??= deps.join(roomId, { joinProof: entry.resolved.joinProof });
    const result = await entry.joinOperation.execute();
    const current = await deps.getSession();
    if (!sameOwner(entry, current)) throw changed();
    if (result?.roomId !== roomId) throw invalid();
    return result;
  }
  return { resolve, resolveToken, peek, join, clear: () => entries.clear(), dispose: unsubscribe };
}

export const invitationFlow = createInvitationFlow({
  getSession,
  resolve: roomMutations.resolveInvite,
  join: roomMutations.join,
  subscribe: api.subscribeSession,
});
