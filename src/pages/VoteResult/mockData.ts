import type { ResultPlace, ResultState } from './types';

export const meetingSummary = '11월 15일 (일) 18:00 · 건대입구역 인근';
export const tieCandidates: ResultPlace[] = [
  {
    id: 'cafe-c',
    name: 'C 카페',
    distanceMeters: 320,
    address: '서울 성동구 왕십리로 20',
    tieVotes: 2,
    votes: { like: 2, neutral: 1, dislike: 1 },
  },
  {
    id: 'cafe-e',
    name: 'E 카페',
    distanceMeters: 410,
    address: '서울 성동구 왕십리로 22',
    tieVotes: 2,
    votes: { like: 2, neutral: 2, dislike: 0 },
  },
];

export function createResultMock(scenario: string | null): ResultState {
  const categories = [
    {
      id: 'restaurant',
      name: '식당',
      place: {
        id: 'restaurant-a',
        name: 'A 식당',
        distanceMeters: 180,
        address: '서울 성동구 왕십리로 10',
        votes: { like: 3, neutral: 1, dislike: 0 },
      },
    },
    { id: 'cafe', name: '카페', place: { ...tieCandidates[0] } },
    {
      id: 'bar',
      name: '주점',
      place: {
        id: 'bar-d',
        name: 'D 주점',
        distanceMeters: 250,
        address: '서울 성동구 왕십리로 30',
        votes: { like: 1, neutral: 2, dislike: 1 },
      },
    },
  ];
  if (scenario === 'zeroVotes')
    categories.forEach((category) => {
      category.place.votes = { like: 0, neutral: 0, dislike: 0 };
    });
  return {
    categories,
    order: categories.map((category) => category.id),
    unresolvedTie: scenario === 'tie',
    revotesUsed: scenario === 'revoteUsed' ? 1 : 0,
  };
}
