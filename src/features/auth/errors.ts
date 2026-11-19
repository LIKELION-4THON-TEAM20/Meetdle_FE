import { ApiRequestError } from '../../api/client';

export function authErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401 || error.code === 'SESSION_CHANGED')
      return '로그인이 필요해요. 다시 로그인해주세요.';
    if (error.status === 429) return '요청이 많아요. 잠시 후 다시 시도해주세요.';
    if (error.code === 'NETWORK_ERROR')
      return '서버에 연결하지 못했어요. 연결 상태를 확인하고 다시 시도해주세요.';
    if (error.code === 'INVITATION_EXPIRED' || error.status === 410)
      return '초대가 만료됐어요. 새 초대 링크나 코드를 받아주세요.';
    if (
      error.code === 'INVALID_INVITATION' ||
      error.code === 'INVITATION_NOT_FOUND' ||
      error.status === 404
    )
      return '초대 정보나 코드를 확인해주세요.';
    if (error.code === 'UPCOMING_ROOM')
      return '다가오는 약속은 숨길 수 없어요. 최신 목록을 확인해주세요.';
    if (error.code === 'INVALID_CURSOR')
      return '목록 조회 정보가 만료됐어요. 처음부터 다시 불러와주세요.';
    if (error.code === 'ROOM_FULL') return '방이 가득 찼어요. 더 이상 참여할 수 없어요.';
    if (error.code === 'JOIN_CLOSED') return '이미 진행 중이거나 참여가 마감된 약속이에요.';
    if (error.status === 403)
      return '요청 권한을 확인하지 못했어요. 다시 로그인한 뒤 시도해주세요.';
    if (error.code === 'INVALID_RESPONSE')
      return '서버 응답을 확인하지 못했어요. 다시 시도해주세요.';
    if (error.status === 503) return '서버가 잠시 응답하지 않아요. 잠시 후 다시 시도해주세요.';
  }
  return '요청을 처리하지 못했어요. 다시 시도해주세요.';
}
