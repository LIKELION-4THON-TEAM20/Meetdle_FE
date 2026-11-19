import { getSession } from '../../api/auth';
import { ApiRequestError } from '../../api/client';
import { getInvitePreview, roomMutations } from '../../api/rooms';
import type { ResolvedInvite, SessionResponse } from '../../api/types';

export function isInviteToken(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function normalizeInviteCode(value: string) {
  const code = value.trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(code) ? code : null;
}

export async function loadInvitation(token: string, signal: AbortSignal) {
  const session = await getSession({ refresh: true }).catch((error: unknown) => {
    if (error instanceof ApiRequestError && error.status === 401) return null;
    throw error;
  });
  signal.throwIfAborted();
  const preview = await getInvitePreview(token, signal);
  return { session, preview };
}

export async function resolveInvitationCode(token: string, roomId: string, code: string) {
  const normalized = normalizeInviteCode(code);
  if (!isInviteToken(token) || !normalized) throw new TypeError('Invalid invitation details');
  const resolved = await roomMutations
    .resolveInvite({ code: normalized, inviteToken: token })
    .execute();
  if (resolved.preview.roomId !== roomId) throw new TypeError('Invitation room changed');
  return resolved;
}

export async function joinResolvedInvitation(
  resolved: ResolvedInvite,
  session: SessionResponse,
  signal?: AbortSignal,
) {
  const current = await getSession({ refresh: true });
  signal?.throwIfAborted();
  if (current.user.userId !== session.user.userId || current.csrfToken !== session.csrfToken) {
    throw new ApiRequestError(null, {
      code: 'SESSION_CHANGED',
      message: 'Invitation session changed',
    });
  }
  const { roomId } = resolved.preview;
  if (!(Date.parse(resolved.joinProofExpiresAt) > Date.now())) {
    throw new ApiRequestError(410, { code: 'JOIN_PROOF_EXPIRED', message: 'Join proof expired' });
  }
  const result = await roomMutations.join(roomId, { joinProof: resolved.joinProof }).execute();
  if (result.roomId !== roomId) throw new TypeError('Joined room does not match invitation');
  return roomId;
}

export function invitationError(error: unknown, step: 'preview' | 'code' | 'join') {
  if (!(error instanceof ApiRequestError))
    return '초대 정보를 처리하지 못했어요. 다시 시도해주세요.';
  if (error.code === 'SESSION_CHANGED' || error.status === 401)
    return '로그인 상태를 다시 확인해주세요.';
  if (error.code === 'NETWORK_ERROR') return '서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.';
  if (error.status === 410) {
    return step === 'join'
      ? '가입 확인 시간이 지났어요. 초대 코드를 다시 확인해주세요.'
      : '만료된 초대예요.';
  }
  if (error.status === 429) {
    const seconds = error.details?.retryAfterSeconds;
    return typeof seconds === 'number'
      ? `요청이 너무 많아요. ${Math.ceil(seconds)}초 뒤에 다시 시도해주세요.`
      : '요청이 너무 많아요. 잠시 후 다시 시도해주세요.';
  }
  if (error.code === 'ROOM_FULL') return '약속방의 정원이 찼어요.';
  if (error.code === 'JOIN_CLOSED') return '이 약속방의 참여가 마감됐어요.';
  if (error.status === 404) {
    if (step === 'code') return '초대 코드가 링크와 일치하지 않아요.';
    if (step === 'join') return '가입 확인 정보를 사용할 수 없어요. 초대 코드를 다시 확인해주세요.';
    return '초대 링크를 찾을 수 없어요.';
  }
  if (error.status === 403) return '이 초대를 사용할 수 없어요. 로그인 상태를 확인해주세요.';
  return '초대 정보를 처리하지 못했어요. 다시 시도해주세요.';
}
