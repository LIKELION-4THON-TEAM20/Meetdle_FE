import type { ResultPlace, VoteCounts } from './types';

export function getSelectionReason(
  place: ResultPlace,
  candidates: ResultPlace[],
  autoSelected = false,
) {
  const { like, neutral, dislike } = place.votes;
  if (autoSelected) return '후보가 한 곳이라 자동 선정됐어요';
  if (like + neutral + dislike === 0) return '집계된 응답이 없어요';
  if (like > 0 && neutral + dislike === 0) return '모두가 좋아한 장소예요';
  if (dislike === 0) return '아무도 싫어하지 않는 장소예요';
  if (
    like > 0 &&
    candidates.length > 1 &&
    candidates.every((candidate) => candidate.votes.like <= like)
  )
    return '가장 많은 사람이 좋아한 장소예요';
  return '투표 집계 기준으로 선정된 후보예요';
}

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
