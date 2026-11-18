import type { MyRoomSummary, Phase } from '../../api/types';
import type { Appointment } from '../../pages/Home/appointment.types';
import { ApiRequestError } from '../../api/client';
import { isServerRoomId } from '../../api/rooms';

const PHASE_LABELS: Record<Phase, string> = {
  WAITING_FOR_DEPARTURE: '일정 입력 중',
  OPTIONS_READY: '후보 비교',
  REGION_CONFIRMED: '일시 확정',
  PLACE_SUBMISSION_OPEN: '장소 등록 중',
  PLACE_SUBMISSION_CLOSED: '장소 등록 종료',
  VOTING_OPEN: '투표 중',
  VOTE_REVIEW_REQUIRED: '투표 확인',
  WAITING_FOR_HOST_DECISION: '방장 선택 대기',
  FINAL_PLACE_CONFIRMED: '약속 확정',
  RECOVERY_REQUIRED: '재등록 확인',
  ENDED: '종료',
};
export function roomEntryUrl(roomId: string) {
  if (!isServerRoomId(roomId)) throw new TypeError('Expected server room UUID');
  return `/rooms/${roomId}`;
}
export function phaseLabel(phase: Phase) {
  return PHASE_LABELS[phase];
}
export function toAppointment(room: MyRoomSummary): Appointment {
  if (
    !room ||
    !isServerRoomId(room.roomId) ||
    !Object.hasOwn(PHASE_LABELS, room.phase) ||
    !room.dates ||
    !Number.isInteger(room.joinedCount)
  ) {
    throw new ApiRequestError(200, { code: 'INVALID_RESPONSE', message: 'Invalid room summary.' });
  }
  const date = room.meetingAt
    ? new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(room.meetingAt))
    : room.dates.from;
  return {
    id: room.roomId,
    name: room.title ?? '이름 없는 약속',
    date,
    status: room.phase === 'ENDED' ? 'completed' : 'in-progress',
    participants: [],
    participantCount: room.joinedCount,
    badgeLabel: phaseLabel(room.phase),
    entryPath: roomEntryUrl(room.roomId),
  };
}
