import type { RegistrationParticipant, VotingEligibility } from './types';

const participants: RegistrationParticipant[] = [
  { id: 'sangmin', name: '상민', status: 'completed' },
  { id: 'jieun', name: '지은', status: 'completed' },
  { id: 'haneul', name: '하늘', status: 'inProgress' },
  { id: 'yujin', name: '유진', status: 'notStarted' },
];

export function createRegistrationStatusMock(now: number, scenario: string | null) {
  return {
    participants: participants.map((participant, index): RegistrationParticipant => ({
      ...participant,
      status:
        scenario === 'allCompleted' || (scenario === 'partial' && index === 2)
          ? 'completed'
          : participant.status,
    })),
    deadline:
      now + (scenario === 'expired' ? -1 : scenario === 'expiringSoon' ? 10 : 2 * 60 * 60) * 1000,
    votingEligibility: (scenario === 'insufficient'
      ? 'insufficient'
      : 'unknown') as VotingEligibility,
  };
}
