import type { Category, CategoryId } from './types';
import { HOUR } from './deadlineUtils';

export const CATEGORIES: Category[] = [
  { id: 'restaurant', label: '식당', required: true },
  { id: 'cafe', label: '카페', required: true },
  { id: 'pub', label: '주점', required: false },
  { id: 'culture', label: '문화시설', required: false },
];

// Product rule, independent from the introductory copy and category counts.
export const REGISTRATION_RULES = { minimumPlacesPerPerson: 2 };

export function createSetupMock(now: number, scenario: string | null) {
  const hoursUntilMeeting =
    scenario === 'under24'
      ? 4.5
      : scenario === 'invalidPreset'
        ? 5
        : scenario === 'under3'
          ? 2
          : 48;
  return {
    meetingStartsAt: now + hoursUntilMeeting * HOUR,
    initialDeadline: now + 3 * HOUR,
    initialMode: hoursUntilMeeting < 24 ? ('oneHour' as const) : ('custom' as const),
    selectedCategories:
      scenario === 'noCategories' ? [] : CATEGORIES.map(({ id }): CategoryId => id),
  };
}
