import type { RoomState } from '../../api/types';
import type { ShareKind } from './shareModel';
type Notice =
  | { kind: 'meetingChanged'; selectionId: string }
  | {
      kind: 'registrationExtended' | 'registrationRestarted' | 'votingExtended';
      round: number;
      closesAt: string;
    };
const key = (room: RoomState) => `meetdle:share-notice:${room.roomId}:${room.me.participantId}`;
export function rememberShareNotice(room: RoomState, notice: Notice) {
  try {
    sessionStorage.setItem(key(room), JSON.stringify(notice));
  } catch {
    /* Optional UI context. */
  }
}
export function currentShareKind(room: RoomState, fallback: ShareKind): ShareKind {
  try {
    const notice = JSON.parse(sessionStorage.getItem(key(room)) ?? 'null') as Notice | null;
    if (!notice) return fallback;
    if (notice.kind === 'meetingChanged')
      return fallback === 'meetingConfirmed' &&
        room.phase === 'REGION_CONFIRMED' &&
        room.meeting?.selectionId === notice.selectionId
        ? notice.kind
        : fallback;
    if (
      fallback === 'registrationRequest' &&
      notice.kind !== 'votingExtended' &&
      room.phase === 'PLACE_SUBMISSION_OPEN' &&
      room.registration?.round === notice.round &&
      room.registration.closesAt === notice.closesAt
    )
      return notice.kind;
    if (
      fallback === 'votingRequest' &&
      notice.kind === 'votingExtended' &&
      room.phase === 'VOTING_OPEN' &&
      room.voting?.round === notice.round &&
      room.voting.closesAt === notice.closesAt
    )
      return notice.kind;
  } catch {
    /* Storage is not part of the room state. */
  }
  return fallback;
}
