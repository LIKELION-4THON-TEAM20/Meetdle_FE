import { CREATED_ROOM_PREVIEW_ID } from '../../features/createdRoom/model';
import { createMockRoom, HOUR, type MockRoom } from '../../features/mockRoom/model';
import type { CandidateData, CandidateConfirmationRequest } from '../TimeRegionCandidates/types';
import { MOCK_CONFIRMED_MEETING } from './mockData';

const date = new Intl.DateTimeFormat('ko-KR', {
  month: 'long',
  day: 'numeric',
  timeZone: 'Asia/Seoul',
});
const weekday = new Intl.DateTimeFormat('ko-KR', {
  weekday: 'long',
  timeZone: 'Asia/Seoul',
});
const time = new Intl.DateTimeFormat('ko-KR', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Asia/Seoul',
});

export function getMeetingConfirmation(room: MockRoom) {
  const details = room.confirmation ?? MOCK_CONFIRMED_MEETING;
  const endsAt = room.confirmation?.endsAt ?? room.meetingAt + 2 * HOUR;
  const start = time.format(room.meetingAt);
  const day = weekday.format(room.meetingAt);
  const summaryEnd =
    date.format(room.meetingAt) === date.format(endsAt)
      ? time.format(endsAt)
      : `${date.format(endsAt)} ${time.format(endsAt)}`;
  return {
    ...details,
    area: room.area,
    totalCount: room.participants.length,
    dateTime: `${date.format(room.meetingAt)} ${day} · ${start}`,
    summaryDateTime: `${date.format(room.meetingAt)} (${day[0]}) ${start}–${summaryEnd}`,
  };
}

export function getConfirmationRegistrationStatus(room: MockRoom, previewStatus: string | null) {
  if (previewStatus === 'beforeRegistration' || previewStatus === 'registrationOpen')
    return previewStatus;
  if (room.registrationClosed || room.phase !== 'registration') return 'registrationClosed';
  if (!(room.registrationStarted ?? room.id !== CREATED_ROOM_PREVIEW_ID))
    return 'beforeRegistration';
  return 'registrationOpen';
}

export function createCandidateConfirmation(
  data: CandidateData,
  request: CandidateConfirmationRequest,
  now: number,
  roomId: string,
): MockRoom | null {
  const selectedTime = data.timeCandidates.find(({ id }) => id === request.timeCandidateId);
  const region = data.regionCandidates.find(({ id }) => id === request.regionCandidateId);
  if (!selectedTime || !region) return null;
  const parseTime = (timeOfDay: string) => {
    if (timeOfDay === '24:00') return Date.parse(`${selectedTime.date}T00:00:00+09:00`) + 24 * HOUR;
    return Date.parse(`${selectedTime.date}T${timeOfDay}:00+09:00`);
  };
  const meetingAt = parseTime(selectedTime.startTime);
  let endsAt = parseTime(selectedTime.endTime);
  if (!Number.isFinite(meetingAt) || !Number.isFinite(endsAt) || endsAt === meetingAt) return null;
  if (endsAt < meetingAt) endsAt += 24 * HOUR;
  return {
    ...createMockRoom(now, roomId),
    meetingAt,
    area: `${region.stationName} 근처`,
    registrationStarted: false,
    confirmation: {
      endsAt,
      availableCount: selectedTime.availableCount,
      averageTravelMinutes: region.averageTravelMinutes,
      maximumTravelMinutes: region.maximumTravelMinutes,
      averageTransfers: region.averageTransfers,
    },
  };
}
