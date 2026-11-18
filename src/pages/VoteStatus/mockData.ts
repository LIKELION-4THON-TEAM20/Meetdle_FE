import type { VoteParticipant } from './types';

export const FIXED_STATUS_NOW = new Date('2026-11-13T18:00:00+09:00').getTime();

export function createVoteStatusMock(now: number, scenario: string | null) {
  const completed =
    scenario === 'allCompleted'
      ? 4
      : scenario === 'oneCompleted' || scenario === 'insufficient'
        ? 1
        : scenario === 'twoCompleted'
          ? 2
          : 3;
  const participants: VoteParticipant[] = ['상민', '지은', '하늘', '유진'].map((name, index) => ({
    id: `voter-${index}`,
    name,
    completed: index < completed,
  }));
  const expired = scenario === 'expired' || scenario === 'insufficient' || scenario === 'extend';
  return { participants, deadline: expired ? now - 1000 : now + (2 * 3600 + 15 * 60 + 30) * 1000 };
}
