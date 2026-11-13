import type { MeetingInfo } from '../RoomCreated/types';

export const MOCK_ROOM_INVITATION: { hostName: string; meeting: MeetingInfo } = {
  hostName: '민수',
  meeting: {
    name: '11월 동기 모임',
    candidateDates: '11.14(토) - 11.17(화)',
    capacity: 4,
    participantCount: 2,
  },
};
