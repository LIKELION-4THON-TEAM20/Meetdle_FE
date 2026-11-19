import type { CreateRoomResponse, RoomState } from '../../api/types';
import { isServerRoomId } from '../../api/rooms';
import { PATHS } from '../../router/paths';
import { meetingActions } from './meeting';

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
      if (!room.startedAt && (room.me.role === 'HOST' || room.startedAt === null))
        return PATHS.recruitment;
      return room.allowedActions.includes('EDIT_INPUT') ? PATHS.schedule : PATHS.participation;
    case 'OPTIONS_READY':
      return room.me.role === 'HOST' ? PATHS.candidates : PATHS.participation;
    case 'REGION_CONFIRMED':
      return room.me.role === 'HOST' ? PATHS.confirmed : PATHS.info;
    case 'PLACE_SUBMISSION_OPEN':
      return room.me.role === 'MEMBER' && meetingActions(room).canRegister
        ? PATHS.info
        : PATHS.registration;
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

export function roomScreenForEntry(room: RoomState, requested?: string) {
  if (room.meeting) {
    const actions = meetingActions(room);
    if (requested === PATHS.info) return requested;
    if (requested === PATHS.confirmed) {
      return actions.beforeRegistration && room.me.role === 'HOST' ? requested : PATHS.info;
    }
    if (requested === PATHS.setup && actions.canSetup) return requested;
    if (requested === PATHS.candidates && actions.canReselect) return requested;
    if (requested === PATHS.places && actions.canRegister) return requested;
    if (requested === PATHS.registration && room.phase === 'PLACE_SUBMISSION_OPEN')
      return requested;
    if (requested === PATHS.places && room.phase === 'PLACE_SUBMISSION_OPEN')
      return PATHS.registration;
  }
  if (room.phase === 'WAITING_FOR_DEPARTURE') {
    if (requested === PATHS.participation) return requested;
    if (requested === PATHS.schedule && room.allowedActions.includes('EDIT_INPUT'))
      return requested;
    if (requested === PATHS.recruitment && !room.startedAt) return requested;
  }
  return roomScreen(room);
}

export function shouldPollRoom(room: RoomState) {
  const screen = roomScreen(room);
  return (
    (room.phase === 'WAITING_FOR_DEPARTURE' &&
      (screen === PATHS.recruitment || screen === PATHS.participation)) ||
    room.phase === 'PLACE_SUBMISSION_OPEN' ||
    screen === PATHS.voteStatus
  );
}

export function serverScreenUrl(path: string, roomId: string, selectionId?: string) {
  serverRoomUrl(roomId);
  const params = new URLSearchParams({ mode: 'api', roomId });
  if (selectionId) params.set('selectionId', selectionId);
  return `${path}?${params}`;
}
