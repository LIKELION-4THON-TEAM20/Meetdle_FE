import { currentVote, type MockRoom } from '../features/mockRoom/model';
import { PATHS } from './paths';

// 실제 서버 단계 판정이 아니라 기존 목 상태의 진입점만 선택한다.
export function getMockRoomEntryPath(room: MockRoom): string {
  if (room.result) return PATHS.result;
  if (room.phase === 'registration') {
    return room.registrationClosed && room.role === 'host' ? PATHS.startVote : PATHS.registration;
  }
  if (room.phase === 'voting' && !currentVote(room).submitted) return PATHS.vote;
  return PATHS.voteStatus;
}
