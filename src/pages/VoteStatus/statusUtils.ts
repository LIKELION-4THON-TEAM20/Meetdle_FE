import type { VoteParticipant, VoteStatusPhase } from './types';

export function getVoteStatusSummary(
  participants: VoteParticipant[],
  deadline: number,
  now: number,
  closedEarly = false,
) {
  const total = participants.length;
  const completed = participants.filter((participant) => participant.completed).length;
  const allCompleted = total > 0 && completed === total;
  const hasMajority = completed > total / 2;
  const expired = now >= deadline;
  const closed = closedEarly || expired;
  const phase: VoteStatusPhase = allCompleted
    ? 'allCompleted'
    : closed
      ? hasMajority
        ? 'counting'
        : 'insufficient'
      : 'ongoing';
  return {
    total,
    completed,
    allCompleted,
    hasMajority,
    expired,
    closed,
    phase,
    progress: total > 0 ? (completed / total) * 100 : 0,
  };
}
