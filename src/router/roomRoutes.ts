import { PATHS } from './paths';
import { isServerRoomId } from '../api/rooms';
export const ROOM_SCREENS: readonly string[] = [
  PATHS.created,
  PATHS.schedule,
  PATHS.recruitment,
  PATHS.participation,
  PATHS.candidates,
  PATHS.confirmed,
  PATHS.info,
  PATHS.setup,
  PATHS.places,
  PATHS.registration,
  PATHS.closeRegistration,
  PATHS.startVote,
  PATHS.vote,
  PATHS.voteStatus,
  PATHS.result,
];

export function serverRoomId(search: string) {
  const id = new URLSearchParams(search).get('roomId');
  return id && isServerRoomId(id) ? id : null;
}
