import type { TimeSlot, TimeSlotGroup } from './types';

function hourlySlots(start: number, end: number): TimeSlot[] {
  return Array.from({ length: end - start }, (_, index) => {
    const startHour = start + index;
    return { id: `${startHour}:00`, startHour, endHour: startHour + 1 };
  });
}

// Figma SCREEN 03: 1시간 단위, 마지막 칸은 23:00~24:00.
export const TIME_SLOT_GROUPS: readonly TimeSlotGroup[] = [
  { label: '점심 10~14', slots: hourlySlots(10, 14) },
  { label: '오후 14~18', slots: hourlySlots(14, 18) },
  { label: '저녁 18~22', slots: hourlySlots(18, 22) },
  { label: '늦은 밤 22시 이후', slots: hourlySlots(22, 24) },
];
export const TIME_SLOTS = TIME_SLOT_GROUPS.flatMap((group) => group.slots);
