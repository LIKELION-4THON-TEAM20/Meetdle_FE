import { ApiRequestError } from '../../api/client';
import { getRoomState, roomMutations } from '../../api/rooms';
import type { Meeting, RoomState, SelectMeetingRequest } from '../../api/types';

// Retain this operation for one user intent. Its POST handle keeps the same key on retry.
export function calculationOperation(state: RoomState) {
  if (state.me.role !== 'HOST' || !state.allowedActions.includes('CALCULATE_OPTIONS')) {
    throw new Error('현재 상태에서는 후보를 계산할 수 없어요.');
  }
  const handle = roomMutations.calculateOptions(state.roomId, { inputVersion: state.inputVersion });
  let optionsId: string | undefined;
  let pending: Promise<RoomState> | undefined;
  return {
    execute() {
      if (pending) return pending;
      pending = (async () => {
        if (!optionsId) optionsId = (await handle.execute()).optionsId;
        const fresh = await getRoomState(state.roomId);
        if (fresh.roomId !== state.roomId) throw new TypeError('Room response mismatch');
        if (fresh.options?.optionsId !== optionsId)
          throw new Error('계산한 후보를 확인할 수 없어요. 방 상태를 새로 조회해주세요.');
        return fresh;
      })().finally(() => {
        pending = undefined;
      });
      return pending;
    },
  };
}

// PUT has no idempotency key. After a lost response, reconcile GET before any further write.
export function selectionOperation(state: RoomState, body: SelectMeetingRequest) {
  const handle = roomMutations.selectMeeting(state.roomId, body);
  const slot = state.options!.slots.find((item) => item.slotId === body.slotId)!;
  const region = state.options!.regions.find((item) => item.candidateId === body.candidateId)!;
  let attempted = false;
  let rejected: unknown;
  let selected: Meeting | undefined;
  let pending: Promise<RoomState> | undefined;
  return {
    execute() {
      if (pending) return pending;
      pending = (async () => {
        if (!attempted) {
          attempted = true;
          try {
            selected = await handle.execute();
          } catch (error) {
            if (
              error instanceof ApiRequestError &&
              error.status !== null &&
              error.status >= 400 &&
              error.status < 500
            )
              rejected = error;
            throw error;
          }
        }
        const fresh = await getRoomState(state.roomId);
        if (fresh.roomId !== state.roomId) throw new TypeError('Room response mismatch');
        if (rejected) throw rejected;
        const meeting = fresh.meeting;
        const matches =
          meeting &&
          meeting.station.stationId === region.station.stationId &&
          Date.parse(meeting.meetingAt) === Date.parse(slot.meetingAt) &&
          Date.parse(meeting.endsAt) === Date.parse(slot.endsAt);
        if (
          !matches ||
          (selected
            ? meeting.selectionId !== selected.selectionId
            : meeting.selectionId === body.expectedSelectionId)
        ) {
          throw new Error(
            '서버의 확정 상태가 선택한 후보와 달라요. 방 상태를 다시 조회한 뒤 확인해주세요.',
          );
        }
        return fresh;
      })().finally(() => {
        pending = undefined;
      });
      return pending;
    },
  };
}
