import type { VoteCategory, VoteState } from './types';

export const FIXED_VOTE_NOW = new Date('2026-11-13T18:00:00+09:00').getTime();

export const voteCategories: VoteCategory[] = [
  {
    id: 'restaurant',
    name: '식당',
    places: [
      {
        id: 'restaurant-a',
        name: 'A 식당',
        distanceMeters: 320,
        address: '서울 성동구 왕십리로 10',
      },
      {
        id: 'restaurant-b',
        name: 'B 식당',
        distanceMeters: 180,
        address: '서울 성동구 왕십리로 12',
      },
      {
        id: 'restaurant-c',
        name: 'C 식당',
        distanceMeters: 240,
        address: '서울 성동구 왕십리로 14',
      },
    ],
  },
  {
    id: 'cafe',
    name: '카페',
    places: [
      { id: 'cafe-a', name: 'A 카페', distanceMeters: 90, address: '서울 성동구 왕십리로 20' },
      { id: 'cafe-b', name: 'B 카페', distanceMeters: 150, address: '서울 성동구 왕십리로 22' },
    ],
  },
  {
    id: 'pub',
    name: '주점',
    places: [
      { id: 'bar-a', name: 'A 주점', distanceMeters: 210, address: '서울 성동구 왕십리로 30' },
      { id: 'bar-b', name: 'B 주점', distanceMeters: 280, address: '서울 성동구 왕십리로 32' },
    ],
  },
  {
    id: 'culture',
    name: '문화시설',
    places: [
      {
        id: 'culture-c',
        name: 'C 전시관',
        distanceMeters: 350,
        address: '서울 성동구 왕십리로 40',
      },
    ],
  },
];

export function createVoteMock(now: number, scenario: string | null) {
  const state: VoteState = { responses: {}, submitted: scenario === 'submitted' };
  const targets = voteCategories.flatMap((category) =>
    category.places.length > 1 ? category.places : [],
  );
  const choices = ['like', 'neutral', 'dislike', 'like', 'neutral', 'like', 'neutral'] as const;
  const count =
    scenario === 'partial'
      ? 3
      : ['complete', 'submitted'].includes(scenario ?? '')
        ? targets.length
        : 0;
  targets.slice(0, count).forEach((place, index) => {
    state.responses[place.id] = choices[index];
  });
  return {
    roomName: '11월 동기 모임',
    categories: voteCategories,
    deadline: now + (60 * 60 + 24 * 60 + 30) * 1000,
    state,
  };
}
