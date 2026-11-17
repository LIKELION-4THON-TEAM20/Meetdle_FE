import type { CandidateData } from './types';

// Figma 예시를 옮긴 독립 fixture이며 추천/이동시간 계산 결과가 아니다.
export const MOCK_CANDIDATE_DATA: CandidateData = {
  timeCandidates: [
    {
      id: 'time-1115-evening',
      date: '2026-11-15',
      startTime: '18:00',
      endTime: '20:00',
      availableCount: 4,
      totalCount: 4,
      allParticipantsAvailable: true,
      recommended: true,
      averageWaitMinutes: 0,
      unavailableParticipantNames: [],
    },
    {
      id: 'time-1116-evening',
      date: '2026-11-16',
      startTime: '19:00',
      endTime: '21:00',
      availableCount: 3,
      totalCount: 4,
      allParticipantsAvailable: false,
      recommended: false,
      unavailableParticipantNames: ['민지'],
    },
  ],
  regionCandidates: [
    {
      id: 'region-konkuk',
      stationName: '건대입구역',
      subwayLines: ['2', '7'],
      recommended: true,
      recommendationLabel: '이동시간 균형이 좋아요',
      averageTravelMinutes: 29,
      maximumTravelMinutes: 38,
      averageTransfers: 0.7,
      participantTravels: [
        { participantId: 'minji', name: '민지', transportLabel: '도보', minutes: 12, transfers: 0 },
        {
          participantId: 'seojun',
          name: '서준',
          transportLabel: '버스',
          minutes: 24,
          transfers: 1,
        },
        {
          participantId: 'haeun',
          name: '하은',
          transportLabel: '지하철',
          minutes: 31,
          transfers: 1,
        },
        {
          participantId: 'jiho',
          name: '지호',
          transportLabel: '지하철',
          minutes: 18,
          transfers: 0,
        },
      ],
    },
    {
      id: 'region-wangsimni',
      stationName: '왕십리역',
      subwayLines: ['2', '5'],
      recommended: false,
      recommendationLabel: '환승 부담이 적어요',
      averageTravelMinutes: 34,
      maximumTravelMinutes: 46,
      averageTransfers: 1.2,
      // 이 역의 참여자별 상세는 디자인에 없어 임의의 값을 만들지 않는다.
      participantTravels: [],
    },
  ],
};
