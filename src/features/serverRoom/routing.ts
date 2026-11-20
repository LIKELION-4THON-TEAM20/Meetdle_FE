import type { CreateRoomResponse, RoomState } from '../../api/types';
import { isServerRoomId } from '../../api/rooms';
import { PATHS } from '../../router/paths';
import { meetingActions } from './meeting';
import { registrationWindow } from '../../pages/PlaceRegistrationSetup/serverSetupModel';
import { ballotPermissions } from './voting';

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
    case 'WAITING_FOR_DEPARTURE': {
      if (!room.startedAt) {
        if (room.me.role === 'HOST')
          return room.joinedCount <= 1 ? PATHS.created : PATHS.participation;
        if (room.startedAt === null) return PATHS.recruitment;
      }
      const me = room.members?.find((member) => member.participantId === room.me.participantId);
      const complete =
        !!room.myInput?.completedAt || me?.inputComplete || me?.inputStatus === 'COMPLETED';
      return !complete &&
        (room.allowedActions.includes('EDIT_INPUT') ||
          room.allowedActions.includes('COMPLETE_INPUT'))
        ? PATHS.schedule
        : PATHS.participation;
    }
    case 'OPTIONS_READY':
      return room.me.role === 'HOST' ? PATHS.candidates : PATHS.participation;
    case 'REGION_CONFIRMED':
      return PATHS.confirmed;
    case 'PLACE_SUBMISSION_OPEN':
      return meetingActions(room).canRegister ? PATHS.places : PATHS.registration;
    case 'PLACE_SUBMISSION_CLOSED':
      return room.me.role === 'HOST' &&
        room.allowedActions.includes('START_VOTING') &&
        !!room.registration &&
        room.registration.progress.completedCount >= room.registration.progress.capacity
        ? PATHS.startVote
        : PATHS.registration;
    case 'VOTING_OPEN': {
      const { edit, submit } = ballotPermissions(room, Date.parse(room.serverNow));
      return edit || submit ? PATHS.vote : PATHS.voteStatus;
    }
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
  if (
    room.phase === 'PLACE_SUBMISSION_OPEN' &&
    meetingActions(room).canRegister &&
    (!requested || [PATHS.confirmed, PATHS.info, PATHS.setup].some((path) => path === requested))
  )
    return PATHS.places;
  if (
    room.phase === 'WAITING_FOR_DEPARTURE' &&
    (room.me.role === 'HOST' || !!room.startedAt) &&
    (!requested ||
      [PATHS.created, PATHS.recruitment, PATHS.participation].some((path) => path === requested))
  )
    return roomScreen(room);
  if (
    requested === PATHS.voteStatus &&
    (room.phase === 'VOTING_OPEN' ||
      (room.me.role === 'HOST' &&
        !!room.voting &&
        ['RESULT_READY', 'WAITING_FOR_HOST_DECISION'].includes(room.phase)))
  )
    return requested;
  if (
    requested === PATHS.closeRegistration &&
    ['PLACE_SUBMISSION_OPEN', 'PLACE_SUBMISSION_CLOSED'].includes(room.phase) &&
    room.me.role === 'HOST'
  )
    return requested;
  if (
    requested === PATHS.startVote &&
    room.phase === 'PLACE_SUBMISSION_CLOSED' &&
    room.me.role === 'HOST' &&
    room.allowedActions.includes('START_VOTING')
  )
    return requested;
  if (
    requested === PATHS.candidates &&
    ['WAITING_FOR_DEPARTURE', 'OPTIONS_READY'].includes(room.phase) &&
    room.me.role === 'HOST'
  )
    return requested;
  if (room.meeting) {
    const actions = meetingActions(room);
    if (requested === PATHS.info) return requested;
    if (requested === PATHS.confirmed) {
      return actions.beforeRegistration ? requested : PATHS.info;
    }
    if (requested === PATHS.setup) {
      if (
        room.me.role === 'HOST' &&
        actions.beforeRegistration &&
        !room.registration &&
        (actions.canSetup || !registrationWindow(room, Date.parse(room.serverNow)).canOpen)
      ) {
        return requested;
      }
      if (room.phase === 'PLACE_SUBMISSION_OPEN')
        return actions.canRegister ? PATHS.places : PATHS.registration;
    }
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
      (screen === PATHS.created ||
        screen === PATHS.recruitment ||
        screen === PATHS.participation)) ||
    room.phase === 'REGION_CONFIRMED' ||
    room.phase === 'PLACE_SUBMISSION_OPEN' ||
    room.phase === 'PLACE_SUBMISSION_CLOSED' ||
    room.phase === 'VOTING_OPEN' ||
    room.phase === 'WAITING_FOR_HOST_DECISION' ||
    room.phase === 'RECOVERY_REQUIRED' ||
    (room.phase === 'RESULT_READY' && (room.me.role === 'MEMBER' || !room.result)) ||
    screen === PATHS.voteStatus
  );
}

export function serverScreenUrl(path: string, roomId: string, selectionId?: string) {
  serverRoomUrl(roomId);
  const params = new URLSearchParams({ mode: 'api', roomId });
  if (selectionId) params.set('selectionId', selectionId);
  return `${path}?${params}`;
}
