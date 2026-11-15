import type { ResultPlace, ResultRole, ResultState, VoteCounts } from './types';

// Largest-remainder rounding keeps displayed percentages at exactly 100 for nonzero totals.
export function getVotePercentages(votes: VoteCounts) {
  const counts = [votes.like, votes.neutral, votes.dislike].map((value) =>
    Number.isFinite(value) && value > 0 ? Math.floor(value) : 0,
  );
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (!total) return { like: 0, neutral: 0, dislike: 0, total: 0 };
  const raw = counts.map((count) => (count / total) * 100);
  const rounded = raw.map(Math.floor);
  const remaining = 100 - rounded.reduce((sum, count) => sum + count, 0);
  const ranked = raw
    .map((value, index) => ({ index, fraction: value - rounded[index] }))
    .sort((a, b) => b.fraction - a.fraction);
  ranked.slice(0, remaining).forEach(({ index }) => {
    rounded[index] += 1;
  });
  return { like: rounded[0], neutral: rounded[1], dislike: rounded[2], total };
}

export function moveVisitOrder(order: string[], id: string, targetIndex: number) {
  const from = order.indexOf(id);
  if (from < 0 || !Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= order.length)
    return order;
  const next = [...order];
  next.splice(from, 1);
  next.splice(targetIndex, 0, id);
  return next;
}

export function saveVisitOrder(state: ResultState, order: string[], role: ResultRole): ResultState {
  const ids = state.categories.map((category) => category.id);
  if (
    role !== 'host' ||
    order.length !== ids.length ||
    new Set(order).size !== ids.length ||
    order.some((id) => !ids.includes(id))
  )
    return state;
  return { ...state, order: [...order] };
}

export function selectTiePlace(
  state: ResultState,
  categoryId: string,
  placeId: string,
  candidates: ResultPlace[],
  role: ResultRole,
): ResultState {
  const place = candidates.find((candidate) => candidate.id === placeId);
  if (
    role !== 'host' ||
    !state.unresolvedTie ||
    !place ||
    !state.categories.some((category) => category.id === categoryId)
  )
    return state;
  return {
    ...state,
    unresolvedTie: false,
    categories: state.categories.map((category) =>
      category.id === categoryId ? { ...category, place } : category,
    ),
  };
}

export function incrementMockRevote(state: ResultState): ResultState {
  return state.revotesUsed >= 1 ? state : { ...state, revotesUsed: state.revotesUsed + 1 };
}
