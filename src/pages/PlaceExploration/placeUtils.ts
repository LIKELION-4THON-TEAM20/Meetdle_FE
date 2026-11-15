import type { ExplorationSnapshot, ExplorationStatusPreview, RecommendedPlace } from './types';

export function registrationBlock(
  snapshot: ExplorationSnapshot,
  place: RecommendedPlace,
  now: number,
): string | null {
  if (!snapshot.registrationOpen || now >= snapshot.deadline) return '장소 등록이 마감됐어요.';
  if (!place.eligible) return '선택 가능한 범위를 벗어난 장소예요.';
  if (!snapshot.categories.some((category) => category.id === place.categoryId))
    return '등록 대상 카테고리가 아니에요.';
  const mine = snapshot.registrations.find(
    (entry) => entry.userId === snapshot.currentUserId && entry.categoryId === place.categoryId,
  );
  if (mine)
    return mine.placeId === place.id
      ? '이미 등록한 장소예요.'
      : '카테고리마다 최대 1곳씩 등록할 수 있어요.';
  return null;
}
export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)}m` : `${Number((meters / 1000).toFixed(1))}km`;
}
export function formatRemaining(deadline: number, now: number): string {
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}
export function statusPreview(snapshot: ExplorationSnapshot): ExplorationStatusPreview {
  return {
    source: 'place-exploration-preview',
    participants: snapshot.participants,
    deadline: snapshot.deadline,
    registeredPlaceCount: snapshot.registeredPlaceCount,
  };
}
export function isExplorationStatusPreview(value: unknown): value is ExplorationStatusPreview {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<ExplorationStatusPreview>;
  return (
    data.source === 'place-exploration-preview' &&
    Number.isFinite(data.deadline) &&
    Number.isInteger(data.registeredPlaceCount) &&
    data.registeredPlaceCount! >= 0 &&
    Array.isArray(data.participants) &&
    data.participants.every(
      (entry) =>
        entry !== null &&
        typeof entry === 'object' &&
        typeof entry.id === 'string' &&
        typeof entry.name === 'string' &&
        ['completed', 'inProgress', 'notStarted'].includes(entry.status),
    )
  );
}
