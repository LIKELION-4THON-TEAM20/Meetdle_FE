import { sortPlaceCategories } from '../../features/places/categoryOrder';
import type { CategoryAvailability, OpenRegistrationRequest, RoomState } from '../../api/types';
import { ApiRequestError } from '../../api/client';
import { toUiCategory } from '../../api/mappers';
import { HOUR } from './deadlineUtils';
import type { CategoryId } from './types';

const minute = 60_000;
const seoulOffset = 9 * HOUR;
const labels: Record<CategoryId, string> = {
  restaurant: '식당',
  cafe: '카페',
  pub: '주점',
  culture: '문화시설',
};

export function registrationWindow(room: RoomState, now: number) {
  const startsAt = Date.parse(room.meeting?.meetingAt ?? '');
  const minimumMinutes =
    room.deadlinePolicy?.registrationMinimumMinutes ?? (startsAt - now >= 6 * HOUR ? 60 : 30);
  const minimum = now + minimumMinutes * minute;
  const maximum = room.deadlinePolicy?.registrationCutoff
    ? Date.parse(room.deadlinePolicy.registrationCutoff)
    : startsAt - 3.5 * HOUR;
  return {
    minimumMinutes,
    minimum,
    maximum,
    canOpen: Number.isFinite(minimum) && Number.isFinite(maximum) && minimum <= maximum,
    under24Hours: startsAt - now < 24 * HOUR,
  };
}

export function seoulInput(timestamp: number) {
  return new Date(timestamp + seoulOffset).toISOString().slice(0, 16);
}

export function parseSeoulInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return NaN;
  const parsed = Date.parse(`${value}:00+09:00`);
  return Number.isFinite(parsed) && seoulInput(parsed) === value ? parsed : NaN;
}

export function formatSeoulDeadline(timestamp: number, now: number) {
  const date = new Date(timestamp + seoulOffset);
  const today = new Date(now + seoulOffset);
  const day =
    date.toISOString().slice(0, 10) === today.toISOString().slice(0, 10)
      ? '오늘'
      : `${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일`;
  const hour = date.getUTCHours();
  return `${day} ${hour < 12 ? '오전' : '오후'} ${hour % 12 || 12}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}

export function setupCategories(availability: CategoryAvailability) {
  return sortPlaceCategories(availability.categories).map((item) => ({
    ...item,
    id: toUiCategory[item.category],
    label: labels[toUiCategory[item.category]],
  }));
}

export function registrationRequest(
  room: RoomState,
  availability: CategoryAvailability,
  required: readonly CategoryId[],
  now: number,
  explicitDeadline?: number,
): OpenRegistrationRequest | null {
  if (
    room.me.role !== 'HOST' ||
    room.phase !== 'REGION_CONFIRMED' ||
    room.registration ||
    !room.allowedActions.includes('OPEN_COLLECTION') ||
    room.meeting?.selectionId !== availability.selectionId
  )
    return null;
  if (
    !required.length ||
    new Set(required).size !== required.length ||
    required.includes('culture')
  )
    return null;
  const selected = availability.categories.filter(
    ({ category, available }) => available && required.includes(toUiCategory[category]),
  );
  if (selected.length !== required.length) return null;
  const window = registrationWindow(room, now);
  if (
    !window.canOpen ||
    (explicitDeadline !== undefined &&
      (!Number.isFinite(explicitDeadline) ||
        explicitDeadline < window.minimum ||
        explicitDeadline > window.maximum))
  )
    return null;
  return {
    selectionId: availability.selectionId,
    requiredCategories: selected.map(({ category }) => category).sort(),
    ...(explicitDeadline === undefined
      ? {}
      : { closesAt: new Date(explicitDeadline).toISOString() }),
  };
}

const errors: Record<string, string> = {
  INVALID_DEADLINE: '마감 일시가 현재 설정 범위를 벗어났어요. 다시 선택해주세요.',
  INVALID_REQUIRED_CATEGORIES: '사용 가능한 필수 카테고리를 다시 선택해주세요.',
  WRONG_PHASE: '약속방 단계가 바뀌었어요. 최신 상태를 확인해주세요.',
  STALE_SELECTION: '확정 일시·지역이 바뀌었어요. 최신 장소 등록 설정을 다시 확인해주세요.',
  INSUFFICIENT_TIME: '약속까지 남은 시간이 짧아 장소 등록을 진행하기 어려워요.',
  LOCAL_UNAVAILABLE: '장소 검색을 잠시 사용할 수 없어요. 다시 시도해주세요.',
  FORBIDDEN: '방장만 장소 등록을 설정할 수 있어요.',
  NOT_FOUND: '약속방을 찾을 수 없어요.',
  UNAUTHENTICATED: '로그인 세션이 만료됐어요.',
  NETWORK_ERROR: '서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.',
};

export function setupError(error: unknown) {
  return (
    (error instanceof ApiRequestError && errors[error.code]) ||
    '장소 등록 설정을 처리하지 못했어요. 다시 시도해주세요.'
  );
}
