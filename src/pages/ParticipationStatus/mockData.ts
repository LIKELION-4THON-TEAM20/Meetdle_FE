import type { Participant } from './types';
import profilePreview from '../../assets/icons/room-created/profile.svg';

const participants: Participant[] = [
  { id: 'sangmin', name: '상민', status: 'completed' },
  { id: 'jieun', name: '지은', status: 'completed' },
  { id: 'haneul', name: '하늘', status: 'inProgress' },
  { id: 'yujin', name: '유진', status: 'notStarted' },
];

export const MOCK_PARTICIPATION_SCENARIOS = {
  twoCompleted: participants,
  threeCompleted: participants.map((participant, index): Participant => ({
    ...participant,
    status: index < 3 ? 'completed' : 'notStarted',
  })),
  oneCompleted: participants.map((participant, index): Participant => ({
    ...participant,
    status: index === 0 ? 'completed' : index === 2 ? 'inProgress' : 'notStarted',
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
    case 'threeCompleted':
      return MOCK_PARTICIPATION_SCENARIOS.threeCompleted;
    case 'allCompleted':
      return MOCK_PARTICIPATION_SCENARIOS.allCompleted;
    case 'profiles':
      return [
        { ...participants[0], profileImageUrl: profilePreview },
        { ...participants[1], profileImageUrl: 'data:image/png;base64,AA==' },
        ...participants.slice(2),
      ];
    default:
      return MOCK_PARTICIPATION_SCENARIOS.twoCompleted;
  }
}
