import type { VoteCategory, VoteChoice, VoteResponses, VoteState } from './types';

export const voteChoices: { value: VoteChoice; label: string }[] = [
  { value: 'dislike', label: '싫어요' },
  { value: 'neutral', label: '상관없어요' },
  { value: 'like', label: '좋아요' },
];

export function getVoteProgress(categories: VoteCategory[], responses: VoteResponses) {
  const targets = categories.flatMap((category) =>
    category.places.length > 1 ? category.places : [],
  );
  const completed = targets.filter((place) =>
    voteChoices.some((choice) => choice.value === responses[place.id]),
  ).length;
  return {
    total: targets.length,
    completed,
    percent: targets.length ? (completed / targets.length) * 100 : 0,
    complete: targets.length > 0 && completed === targets.length,
  };
}

export function formatVoteRemaining(deadline: number, now: number) {
  const seconds = Number.isFinite(deadline - now)
    ? Math.max(0, Math.ceil((deadline - now) / 1000))
    : 0;
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

export function getKakaoMapUrl(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      ['map.kakao.com', 'place.map.kakao.com'].includes(url.hostname) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export type VoteAction =
  | { type: 'choose'; placeId: string; choice: VoteChoice; now: number }
  | { type: 'submit'; now: number };

export function updateVote(
  state: VoteState,
  action: VoteAction,
  categories: VoteCategory[],
  deadline: number,
): VoteState {
  if (
    state.submitted ||
    !Number.isFinite(action.now) ||
    !Number.isFinite(deadline) ||
    action.now >= deadline
  )
    return state;
  if (action.type === 'submit')
    return getVoteProgress(categories, state.responses).complete
      ? { ...state, submitted: true }
      : state;
  const eligible = categories.some(
    (category) =>
      category.places.length > 1 && category.places.some((place) => place.id === action.placeId),
  );
  if (!eligible || !voteChoices.some((choice) => choice.value === action.choice)) return state;
  return { ...state, responses: { ...state.responses, [action.placeId]: action.choice } };
}
