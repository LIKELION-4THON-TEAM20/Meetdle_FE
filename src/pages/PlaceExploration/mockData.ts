import { CATEGORIES } from '../PlaceRegistrationSetup/mockData';
import type { ExplorationSnapshot, RecommendedPlace } from './types';

// 임시 응답 모델. 실제 추천 검색·반경 계산을 프론트에서 수행하지 않는다.
export function createExplorationMock(now = Date.now()): ExplorationSnapshot {
  const definitions = [
    ['restaurant-a', 'A 식당', 'restaurant', 37.5631, 127.0351, 320],
    ['restaurant-b', '성수 갈비살집', 'restaurant', 37.5652, 127.039, 420],
    ['restaurant-c', '식당 C', 'restaurant', 37.5601, 127.034, 510],
    ['cafe-a', '성수동 브런치카페', 'cafe', 37.5638, 127.0335, 350],
    ['cafe-b', 'B 카페', 'cafe', 37.568, 127.041, 780],
    ['pub-a', 'A 주점', 'pub', 37.558, 127.036, 640],
    ['pub-b', 'B 주점', 'pub', 37.56, 127.045, 880],
    ['culture-a', '언더스탠드에비뉴', 'culture', 37.558, 127.042, 610],
  ] as const;
  const recommendations: RecommendedPlace[] = definitions.map(
    ([id, name, categoryId, latitude, longitude, distanceMeters]) => ({
      id,
      name,
      categoryId,
      coordinates: { latitude, longitude },
      distanceMeters,
      address: '서울 성동구 (목 데이터)',
      kakaoPlaceId: null,
      // 목 장소는 실제 업체 ID가 없다. 공식 좌표 링크만 사용한다.
      kakaoMapUrl: `https://map.kakao.com/link/map/${encodeURIComponent(name)},${latitude},${longitude}`,
      eligible: true,
    }),
  );
  return {
    source: 'mock',
    roomId: 'exploration-preview',
    currentUserId: 'haneul',
    areaLabel: '왕십리역 근처',
    meetingAt: now + 24 * 3600000,
    deadline: now + (5 * 3600 + 32 * 60 + 10) * 1000,
    registrationOpen: true,
    area: { center: { latitude: 37.5619, longitude: 127.0377 }, radiusMeters: 2500 },
    categories: CATEGORIES,
    recommendations,
    registrations: [
      {
        id: 'mine-restaurant',
        userId: 'haneul',
        placeId: 'restaurant-a',
        categoryId: 'restaurant',
      },
    ],
    participants: [
      { id: 'sangmin', name: '상민', status: 'completed' },
      { id: 'jieun', name: '지은', status: 'completed' },
      { id: 'haneul', name: '하늘', status: 'inProgress' },
      { id: 'yujin', name: '유진', status: 'completed' },
    ],
    registeredPlaceCount: 8,
  };
}
