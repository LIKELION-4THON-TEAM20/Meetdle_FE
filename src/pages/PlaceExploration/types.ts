import type { CategoryId } from '../PlaceRegistrationSetup/types';

export type { CategoryId };
export interface Coordinates {
  latitude: number;
  longitude: number;
}
export interface ExplorationArea {
  center: Coordinates;
  radiusMeters: number;
  // 서버가 확장했을 때만 전달한다. 지도 조작으로 확장하지 않는다.
  expansionMessage?: string;
}
export interface RecommendedPlace {
  id: string; // 서비스 내부 ID
  name: string;
  categoryId: CategoryId;
  coordinates: Coordinates;
  distanceMeters?: number;
  address: string;
  imageUrl?: string;
  kakaoPlaceId: string | null; // 실제 카카오 장소 ID. 내부 ID로 대체하지 않는다.
  kakaoMapUrl: string | null;
  eligible: boolean; // 백엔드의 등록 가능 판정
}
