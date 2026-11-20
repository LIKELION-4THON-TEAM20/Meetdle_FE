import type { VoteChoice } from './types';

export const voteChoices: { value: VoteChoice; label: string }[] = [
  { value: 'dislike', label: '싫어요' },
  { value: 'neutral', label: '상관없어요' },
  { value: 'like', label: '좋아요' },
];

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
