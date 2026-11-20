import { ApiRequestError } from '../../../api/client';
import { isServerRoomId } from '../../../api/rooms';
import type {
  DateRange,
  MyInput,
  RoomState,
  SaveMyInputRequest,
  Station as ApiStation,
} from '../../../api/types';
import { cellKey, normalizeStationQuery } from '../scheduleUtils';
import { TIME_SLOTS } from '../timeSlots';
import type {
  AvailabilityCellKey,
  ScheduleTransitInput,
  Station,
  StationSearchValue,
} from '../types';

export function invalidScheduleResponse(message: string): never {
  throw new ApiRequestError(200, { code: 'INVALID_RESPONSE', message });
}
function dateValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN;
}
export function candidateDates(range: DateRange): string[] {
  const start = dateValue(range?.from ?? '');
  const end = dateValue(range?.through ?? '');
  const count = (end - start) / 86_400_000 + 1;
  if (!Number.isInteger(count) || count < 1 || count > 7)
    invalidScheduleResponse('Invalid candidate date range');
  return Array.from({ length: count }, (_, index) =>
    new Date(start + index * 86_400_000).toISOString().slice(0, 10),
  );
}
export function toUiStation(station: ApiStation): Station {
  if (
    !station ||
    !isServerRoomId(station.stationId) ||
    typeof station.name !== 'string' ||
    !Array.isArray(station.lines) ||
    station.lines.some((line) => typeof line !== 'string')
  )
    invalidScheduleResponse('Invalid station');
  return {
    serverSelectable: true,
    id: station.stationId,
    name: station.name,
    lines: station.lines.map((name) => {
      const matched = /^([1-9])(?:호선)?$/.exec(name);
      return matched ? { id: matched[1], name: `${matched[1]}호선` } : { id: name, name };
    }),
  };
}
export interface RestoredSchedule {
  selected: Set<AvailabilityCellKey>;
  departure: StationSearchValue;
  destination: StationSearchValue;
}
export function restoreScheduleInput(dates: readonly string[], input: MyInput): RestoredSchedule {
  if (
    !input ||
    !Number.isSafeInteger(input.inputRevision) ||
    input.inputRevision < 0 ||
    !Array.isArray(input.slots) ||
    !(
      input.completedAt === null ||
      (typeof input.completedAt === 'string' && Number.isFinite(Date.parse(input.completedAt)))
    )
  )
    invalidScheduleResponse('Invalid myInput');
  const selected = new Set<AvailabilityCellKey>();
  for (const slot of input.slots) {
    const uiSlot = TIME_SLOTS.find((item) => item.startHour === slot.hour);
    if (!uiSlot || !dates.includes(slot.date))
      invalidScheduleResponse('Invalid restored hour slot');
    selected.add(cellKey(slot.date, uiSlot.id));
  }
  const restoreStation = (station: ApiStation | null): StationSearchValue => {
    if (station === null) return { query: '', station: null };
    const ui = toUiStation(station);
    return { query: normalizeStationQuery(ui.name), station: ui };
  };
  return {
    selected,
    departure: restoreStation(input.originStation),
    destination: restoreStation(input.destinationStation),
  };
}
export function assertScheduleState(state: RoomState, roomId: string) {
  if (
    state?.roomId !== roomId ||
    !isServerRoomId(roomId) ||
    !Array.isArray(state.allowedActions) ||
    !state.me?.participantId ||
    !['HOST', 'MEMBER'].includes(state.me.role)
  )
    invalidScheduleResponse('Invalid schedule RoomState');
  restoreScheduleInput(candidateDates(state.dates), state.myInput);
}
export function toSaveInput(state: RoomState, input: ScheduleTransitInput): SaveMyInputRequest {
  assertScheduleState(state, input.roomId);
  if (state.myInput.completedAt || !state.allowedActions.includes('COMPLETE_INPUT'))
    throw new ApiRequestError(409, { code: 'INPUT_LOCKED', message: 'Input locked' });
  if (
    !isServerRoomId(input.departureStationId) ||
    !isServerRoomId(input.destinationStationId) ||
    !input.availability.length
  )
    throw new ApiRequestError(400, { code: 'INPUT_INCOMPLETE', message: 'Missing required input' });
  const dates = candidateDates(state.dates);
  const slots = input.availability.map(({ date, slotId }) => {
    const slot = TIME_SLOTS.find((item) => item.id === slotId);
    if (!slot || !dates.includes(date))
      throw new ApiRequestError(400, { code: 'INVALID_SLOT', message: 'Invalid input slot' });
    return { date, hour: slot.startHour };
  });
  return {
    originStationId: input.departureStationId,
    destinationStationId: input.destinationStationId,
    slots: [...new Map(slots.map((slot) => [`${slot.date}/${slot.hour}`, slot])).values()].sort(
      (a, b) => a.date.localeCompare(b.date) || a.hour - b.hour,
    ),
    inputRevision: state.myInput.inputRevision,
    complete: true,
  };
}
export function matchesSavedInput(input: MyInput, body: SaveMyInputRequest): boolean {
  const normalize = (slots: MyInput['slots']) =>
    [...new Set(slots.map(({ date, hour }) => `${date}/${hour}`))].sort().join(',');
  return (
    input.originStation?.stationId === body.originStationId &&
    input.destinationStation?.stationId === body.destinationStationId &&
    normalize(input.slots) === normalize(body.slots)
  );
}
