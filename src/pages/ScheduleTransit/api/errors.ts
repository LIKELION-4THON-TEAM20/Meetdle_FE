import { ApiRequestError } from '../../../api/client';

export function scheduleErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401 || error.code === 'SESSION_CHANGED')
      return '로그인 세션이 바뀌었어요. 다시 로그인하거나 서버 정보를 다시 불러와주세요.';
    if (error.code === 'STALE_INPUT')
      return '다른 곳에서 입력이 변경됐어요. 최신 서버 정보를 다시 불러온 뒤 확인해주세요.';
    if (error.code === 'INPUT_LOCKED' || error.code === 'WRONG_PHASE')
      return '이미 입력을 완료했거나 입력 가능한 단계가 아니에요. 최신 상태를 확인해주세요.';
    if (error.code === 'UNSUPPORTED_STATION')
      return '지원하지 않는 역이에요. 역을 다시 검색해 선택해주세요.';
    if (error.code === 'INPUT_INCOMPLETE')
      return '가능 시간과 출발역·이후 목적지를 모두 선택해주세요.';
    if (error.code === 'INVALID_SLOT')
      return '선택한 시간이 방의 후보 범위에 포함되는지 확인해주세요.';
    if (error.code === 'INVALID_RESPONSE')
      return '서버의 일정 정보를 확인하지 못했어요. 다시 불러와주세요.';
    if (error.status === 403) return '이 약속방의 입력 권한을 확인하지 못했어요.';
    if (error.status === 404) return '약속방을 찾을 수 없어요. 초대 주소를 확인해주세요.';
    if (error.status === 429) return '요청이 많아요. 잠시 후 다시 시도해주세요.';
    if (error.code === 'NETWORK_ERROR')
      return '서버에 연결하지 못했어요. 연결 상태를 확인하고 다시 시도해주세요.';
  }
  return '일정 정보를 처리하지 못했어요. 다시 시도해주세요.';
}
