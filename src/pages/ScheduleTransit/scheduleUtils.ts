import { TIME_SLOTS } from './timeSlots';
import type {
  AvailabilityCellKey,
  ScheduleRoom,
  ScheduleTransitInput,
  Station,
  StationSearchValue,
  TimeSlotId,
} from './types';

const SUPPORTED_LINE_IDS = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9']);

export function isSupportedStation(station: Station): boolean {
  return station.lines.some((line) => SUPPORTED_LINE_IDS.has(line.id));
}

export function normalizeStationQuery(query: string): string {
  return query.trim().replace(/\s/g, '').replace(/역$/, '');
}

export function searchStations(stations: readonly Station[], query: string): Station[] {
  const normalized = normalizeStationQuery(query);
  if (!normalized) return [];
  return stations.filter((station) => normalizeStationQuery(station.name).includes(normalized));
}

export function changeStationQuery(value: StationSearchValue, query: string): StationSearchValue {
  return {
    query,
    station:
      value.station && normalizeStationQuery(value.station.name) === normalizeStationQuery(query)
        ? value.station
        : null,
  };
}

export function cellKey(date: string, slotId: TimeSlotId): AvailabilityCellKey {
  return `${date}/${slotId}`;
}

// 같은 칸에 선택/해제를 여러 번 적용해도 결과는 같다.
export function paintAvailability(
  selected: ReadonlySet<AvailabilityCellKey>,
  keys: readonly AvailabilityCellKey[],
  select: boolean,
): Set<AvailabilityCellKey> {
  const next = new Set(selected);
  for (const key of keys) {
    if (select) next.add(key);
    else next.delete(key);
  }
  return next;
}

export function formatCandidateDate(value: string): { dateLabel: string; weekday: string } {
  const date = new Date(`${value}T00:00:00Z`);
  return {
    dateLabel: `${date.getUTCMonth() + 1}/${date.getUTCDate()}`,
    weekday: new Intl.DateTimeFormat('ko-KR', { weekday: 'short', timeZone: 'UTC' }).format(date),
  };
}

export function prepareScheduleInput(
  room: ScheduleRoom,
  selected: ReadonlySet<AvailabilityCellKey>,
  departure: StationSearchValue,
  destination: StationSearchValue,
): ScheduleTransitInput | null {
  const departureStation = departure.station;
  const destinationStation = destination.station;
  if (
    !departureStation ||
    !destinationStation ||
    !isSupportedStation(departureStation) ||
    !isSupportedStation(destinationStation)
  )
    return null;
  if (
    normalizeStationQuery(departure.query) !== normalizeStationQuery(departureStation.name) ||
    normalizeStationQuery(destination.query) !== normalizeStationQuery(destinationStation.name)
  )
    return null;
  const availability = [...new Set(room.candidateDates)].flatMap((date) =>
    TIME_SLOTS.filter((slot) => selected.has(cellKey(date, slot.id))).map((slot) => ({
      date,
      slotId: slot.id,
    })),
  );
  if (availability.length === 0) return null;
  return {
    roomId: room.id,
    availability,
    departureStationId: departureStation.id,
    destinationStationId: destinationStation.id,
  };
}
