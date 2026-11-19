import type { RoomState } from '../../api/types';
import { HOUR } from '../../pages/PlaceRegistrationSetup/deadlineUtils';

const labels = { FOOD: '식당', CAFE: '카페', CULTURE: '문화시설', BAR: '주점' };

export function registrationFlow(room: RoomState, now: number) {
  const registration = room.registration;
  const completed = registration?.progress.completedCount ?? 0;
  const capacity = registration?.progress.capacity ?? room.capacity;
  const members = registration?.completion.length ?? 0;
  const closesAt = Date.parse(registration?.closesAt ?? '');
  const host = room.me.role === 'HOST';
  const open =
    room.phase === 'PLACE_SUBMISSION_OPEN' &&
    !!registration &&
    !registration.closedAt &&
    now < closesAt;
  const closed = room.phase === 'PLACE_SUBMISSION_CLOSED' && !!registration;
  const rows = (registration?.categories ?? [])
    .filter(({ available, required }) => available || required)
    .map((entry) => {
      const count =
        registration?.categoryCounts?.find(({ category }) => category === entry.category)?.count ??
        (registration?.categoryCounts ? 0 : undefined);
      return { ...entry, name: labels[entry.category], count };
    });
  const missing = rows.filter(({ required, count }) => required && count === 0);
  const votes = rows.some(({ count }) => count !== undefined && count > 1);
  return {
    host,
    open,
    closed,
    completed,
    capacity,
    members,
    closesAt,
    rows,
    missing,
    canClose:
      host &&
      open &&
      completed >= Math.ceil(capacity / 2) &&
      !missing.length &&
      room.allowedActions.includes('CLOSE_COLLECTION'),
    canMini:
      host &&
      open &&
      completed > capacity / 2 &&
      completed < members &&
      room.allowedActions.includes('START_MINI_TIMER'),
    canExtend: host && closed && room.allowedActions.includes('EXTEND_COLLECTION'),
    canVote:
      host &&
      closed &&
      !missing.length &&
      (registration?.categoryCounts == null || votes) &&
      room.allowedActions.includes('START_VOTING'),
  };
}

export type DeadlineKind = 'MINI_TIMER' | 'EXTEND' | 'VOTE';

export function flowDeadline(room: RoomState, kind: DeadlineKind, now: number) {
  const starts = Date.parse(room.meeting?.meetingAt ?? '');
  if (kind === 'VOTE') {
    return {
      minimum: now + (room.deadlinePolicy?.votingMinimumMinutes ?? 30) * 60_000,
      maximum: room.deadlinePolicy?.votingCutoff
        ? Date.parse(room.deadlinePolicy.votingCutoff)
        : starts - 3 * HOUR,
    };
  }
  const existing = Date.parse(room.registration?.closesAt ?? '');
  return {
    minimum: (kind === 'MINI_TIMER' ? Math.max(existing, now) : now) + 1,
    maximum: room.deadlinePolicy?.registrationCutoff
      ? Date.parse(room.deadlinePolicy.registrationCutoff)
      : starts - 3.5 * HOUR,
  };
}

export const flowErrors: Record<string, string> = {
  WRONG_PHASE: '단계가 변경됐어요. 최신 상태를 확인해주세요.',
  STALE_ROUND: '등록 회차가 바뀌었어요. 다시 확인해주세요.',
  NOT_ALLOWED: '현재 상태에서는 이 동작을 할 수 없어요.',
  NOT_ENOUGH_COMPLETIONS: '등록을 완료한 인원이 부족해요.',
  REQUIRED_CATEGORY_EMPTY: '후보가 없는 필수 카테고리가 있어요.',
  EXTENSION_EXHAUSTED: '이 회차에서 해당 연장을 이미 사용했어요.',
  INVALID_DEADLINE: '마감 시간을 다시 선택해주세요.',
  INSUFFICIENT_TIME: '마감을 설정할 시간이 부족해요.',
  KEY_REUSED: '요청을 다시 확인한 뒤 시도해주세요.',
  UNAUTHENTICATED: '로그인 세션이 만료됐어요.',
  FORBIDDEN: '이 동작을 할 권한이 없어요.',
  NOT_FOUND: '약속방을 찾을 수 없어요.',
  NETWORK_ERROR: '서버에 연결하지 못했어요. 다시 시도해주세요.',
};
