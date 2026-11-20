import type { RoomState } from '../../api/types';

// Display only; retaining the original optionsId and slotId preserves the server selection contract.
export function candidatesForTimeReselection(room: RoomState, now: number): RoomState {
  if (!room.options) return room;
  return {
    ...room,
    options: {
      ...room.options,
      slots: room.options.slots.filter((slot) => Date.parse(slot.meetingAt) - now >= 3 * 3600000),
    },
  };
}
