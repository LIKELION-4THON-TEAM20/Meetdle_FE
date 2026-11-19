import type { RoomState } from '../../api/types';

const seoulDate = new Intl.DateTimeFormat('ko-KR', {
  month: 'long',
  day: 'numeric',
  weekday: 'long',
  timeZone: 'Asia/Seoul',
});
const seoulTime = new Intl.DateTimeFormat('ko-KR', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Asia/Seoul',
});

export function seoulDateTime(instant: string) {
  const timestamp = Date.parse(instant);
  return Number.isFinite(timestamp)
    ? `${seoulDate.format(timestamp)} · ${seoulTime.format(timestamp)}`
    : null;
}

export function meetingDetails(room: RoomState) {
  const meeting = room.meeting;
  if (!meeting) return null;
  const start = Date.parse(meeting.meetingAt);
  const end = Date.parse(meeting.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const firstDay = seoulDate.format(start);
  const endDay = seoulDate.format(end);
  const region = room.options?.regions.find(
    ({ station }) => station.stationId === meeting.station.stationId,
  );
  const slot = room.options?.slots.find(
    (option) => Date.parse(option.meetingAt) === start && Date.parse(option.endsAt) === end,
  );
  return {
    dateTime: `${firstDay} · ${seoulTime.format(start)}–${firstDay === endDay ? '' : `${endDay} · `}${seoulTime.format(end)}`,
    area: meeting.station.name,
    totalCount: room.joinedCount,
    averageTravelMinutes: region?.meanMinutes,
    maximumTravelMinutes: region?.maxMinutes,
    averageTransfers: region?.meanTransfers,
    availableCount: slot?.availableCount,
  };
}

export function meetingActions(room: RoomState, now = Date.parse(room.serverNow)) {
  const beforeRegistration = room.phase === 'REGION_CONFIRMED';
  const host = room.me.role === 'HOST';
  const registration = room.registration;
  const open =
    room.phase === 'PLACE_SUBMISSION_OPEN' &&
    !!registration &&
    !registration.closedAt &&
    now < Date.parse(registration.closesAt);
  return {
    beforeRegistration,
    open,
    canSetup:
      !!room.meeting &&
      host &&
      beforeRegistration &&
      (room.allowedActions.includes('OPEN_COLLECTION') ||
        room.allowedActions.includes('EDIT_ROOM')),
    canReselect:
      !!room.meeting &&
      host &&
      beforeRegistration &&
      room.allowedActions.includes('SELECT_MEETING'),
    canRegister:
      !!room.meeting &&
      open &&
      room.me.canRegister &&
      !registration?.myCompleted &&
      room.allowedActions.includes('EDIT_NOMINATION'),
  };
}

export function meetingShareText(room: RoomState) {
  const details = meetingDetails(room);
  if (!details || !room.shareUrl) return null;
  try {
    const url = new URL(room.shareUrl);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    return {
      text: `${(room.title ?? '약속방').slice(0, 50)}\n${details.dateTime}\n${details.area}`,
      url: url.href,
    };
  } catch {
    return null;
  }
}
