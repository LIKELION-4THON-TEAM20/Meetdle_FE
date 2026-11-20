export type TimeSlotId = `${number}:00`;
export type AvailabilityCellKey = `${string}/${TimeSlotId}`;

export interface TimeSlot {
  id: TimeSlotId;
  startHour: number;
  endHour: number;
}

export interface TimeSlotGroup {
  label: string;
  slots: readonly TimeSlot[];
}

export interface Station {
  serverSelectable?: boolean;
  id: string;
  name: string;
  lines: readonly { id: string; name: string }[];
}

export interface StationSearchValue {
  query: string;
  station: Station | null;
}

export interface ScheduleRoom {
  id: string;
  candidateDates: readonly string[]; // YYYY-MM-DD
}

export interface ScheduleTransitInput {
  roomId: string;
  availability: { date: string; slotId: TimeSlotId }[];
  departureStationId: string;
  destinationStationId: string;
}
