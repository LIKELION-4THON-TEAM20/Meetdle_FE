import type { RegistrationParticipant, RegistrationPhase } from './types';

export function getRegistrationSummary(
  participants: RegistrationParticipant[],
  deadline: number,
  now: number,
) {
  const total = participants.length;
  const completed = participants.filter(({ status }) => status === 'completed').length;
  const allCompleted = total > 0 && completed === total;
  const expired = now >= deadline;
  const phase: RegistrationPhase = expired
    ? 'expired'
    : allCompleted
      ? 'allCompleted'
      : completed > total / 2
        ? 'partial'
        : 'ongoing';
  return {
    total,
    completed,
    allCompleted,
    expired,
    hasIncomplete: completed < total,
    progress: total === 0 ? 0 : (completed / total) * 100,
    phase,
  };
}

// Local mock update only. Expired registration cannot be extended without a product decision.
export function extendRegistrationDeadline(
  deadline: number,
  additionalMinutes: number,
  now: number,
): number | null {
  if (
    !Number.isFinite(deadline) ||
    deadline <= now ||
    !Number.isInteger(additionalMinutes) ||
    additionalMinutes <= 0
  )
    return null;
  const extended = deadline + additionalMinutes * 60 * 1000;
  return Number.isFinite(extended) && Number.isFinite(new Date(extended).getTime())
    ? extended
    : null;
}
