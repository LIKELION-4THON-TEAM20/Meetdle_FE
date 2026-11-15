import type { Participant } from './types';

const participants: Participant[] = [
  { id: 'sangmin', name: '상민', status: 'completed' },
  { id: 'jieun', name: '지은', status: 'completed' },
  { id: 'haneul', name: '하늘', status: 'inProgress' },
  { id: 'yujin', name: '유진', status: 'completed' },
];

export const MOCK_PARTICIPATION_SCENARIOS = {
  threeCompleted: participants,
  oneCompleted: participants.map((participant, index): Participant => ({
    ...participant,
    status: index === 0 ? 'completed' : index === 1 ? 'inProgress' : 'notStarted',
  })),
  allCompleted: participants.map((participant): Participant => ({
    ...participant,
    status: 'completed',
  })),
};

export function getMockParticipants(scenario: string | null): Participant[] {
  switch (scenario) {
    case 'oneCompleted':
      return MOCK_PARTICIPATION_SCENARIOS.oneCompleted;
    case 'allCompleted':
      return MOCK_PARTICIPATION_SCENARIOS.allCompleted;
    default:
      return MOCK_PARTICIPATION_SCENARIOS.threeCompleted;
  }
}
