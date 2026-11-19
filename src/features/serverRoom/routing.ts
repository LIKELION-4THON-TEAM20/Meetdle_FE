import type { CreateRoomResponse, RoomState } from '../../api/types';
import { isServerRoomId } from '../../api/rooms';
import { PATHS } from '../../router/paths';

export function serverRoomUrl(roomId: string) {
  if (!isServerRoomId(roomId)) throw new TypeError('Invalid server room ID');
  return `/rooms/${roomId}`;
}

export function createdRoomDestination(response: CreateRoomResponse) {
  serverRoomUrl(response.roomId);
  const query = new URLSearchParams({ mode: 'api', roomId: response.roomId });
  return { to: `${PATHS.created}?${query}`, state: { createdRoom: response } };
}

export function roomScreen(room: RoomState) {
  switch (room.phase) {
    case 'WAITING_FOR_DEPARTURE':
      if (room.me.role === 'HOST' && room.allowedActions.includes('START_ROOM'))
        return PATHS.recruitment;
      return room.allowedActions.includes('EDIT_INPUT') ? PATHS.schedule : PATHS.participation;
    case 'OPTIONS_READY':
      return room.me.role === 'HOST' ? PATHS.candidates : PATHS.participation;
    case 'REGION_CONFIRMED':
      return room.me.role === 'HOST' ? PATHS.confirmed : PATHS.info;
    case 'PLACE_SUBMISSION_OPEN':
      return PATHS.registration;
    case 'PLACE_SUBMISSION_CLOSED':
      return room.allowedActions.includes('START_VOTING')
        ? PATHS.startVote
        : PATHS.closeRegistration;
    case 'VOTING_OPEN':
      return room.allowedActions.includes('EDIT_PREFERENCES') ||
        room.allowedActions.includes('SUBMIT_VOTE')
        ? PATHS.vote
        : PATHS.voteStatus;
    case 'VOTE_REVIEW_REQUIRED':
      return PATHS.voteStatus;
    case 'WAITING_FOR_HOST_DECISION':
    case 'RESULT_READY':
    case 'FINAL_PLACE_CONFIRMED':
    case 'RECOVERY_REQUIRED':
    case 'ENDED':
      return PATHS.result;
  }
}

export function shouldPollRoom(room: RoomState) {
  const screen = roomScreen(room);
  return (
    (room.phase === 'WAITING_FOR_DEPARTURE' &&
      (screen === PATHS.recruitment || screen === PATHS.participation)) ||
    screen === PATHS.registration ||
    screen === PATHS.voteStatus
  );
}
