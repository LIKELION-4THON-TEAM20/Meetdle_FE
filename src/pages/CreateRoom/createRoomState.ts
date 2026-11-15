import type { DateRange } from './DateCalendar';
import { MIN_CAPACITY, MAX_CAPACITY } from './CapacityPicker';
import type { MeetingInfo } from '../RoomCreated/types';

export type CreateRoomState = Pick<MeetingInfo, 'name' | 'capacity'> & {
  dateRange: DateRange;
};

function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isCreateRoomState(value: unknown): value is CreateRoomState {
  if (typeof value !== 'object' || value === null) return false;
  if (!('name' in value) || typeof value.name !== 'string' || !value.name.trim()) return false;
  if (
    !('capacity' in value) ||
    typeof value.capacity !== 'number' ||
    !Number.isInteger(value.capacity) ||
    value.capacity < MIN_CAPACITY ||
    value.capacity > MAX_CAPACITY
  )
    return false;
  if (!('dateRange' in value) || typeof value.dateRange !== 'object' || value.dateRange === null)
    return false;
  const range = value.dateRange;
  return (
    'start' in range &&
    isDateKey(range.start) &&
    'end' in range &&
    (range.end === null || (isDateKey(range.end) && range.end >= range.start))
  );
}

export function formatCandidateDates({ start, end }: DateRange): string {
  const formatDate = (value: string) => {
    const date = new Date(`${value}T00:00:00Z`);
    const weekday = new Intl.DateTimeFormat('ko-KR', { weekday: 'short', timeZone: 'UTC' }).format(
      date,
    );
    return `${date.getUTCMonth() + 1}/${date.getUTCDate()} (${weekday})`;
  };
  if (!end || start === end) return formatDate(start);
  return `${formatDate(start)} – ${formatDate(end)}`;
}
