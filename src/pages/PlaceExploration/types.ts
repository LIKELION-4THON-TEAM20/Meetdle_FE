import type { CategoryId, Category } from '../PlaceRegistrationSetup/types';
import type { RegistrationParticipant } from '../PlaceRegistrationStatus/types';

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
  distanceMeters: number;
  address: string;
  imageUrl?: string;
  kakaoPlaceId: string | null; // 실제 카카오 장소 ID. 내부 ID로 대체하지 않는다.
  kakaoMapUrl: string | null;
  eligible: boolean; // 백엔드의 등록 가능 판정
}
export interface PlaceRegistration {
  id: string;
  userId: string;
  placeId: string;
  categoryId: CategoryId;
}
export interface ExplorationSnapshot {
  source: 'mock' | 'api';
  roomId: string;
  currentUserId: string;
  areaLabel: string;
  meetingAt: number;
  deadline: number;
  registrationOpen: boolean;
  area: ExplorationArea;
  categories: readonly Category[];
  recommendations: RecommendedPlace[];
  registrations: PlaceRegistration[];
  participants: RegistrationParticipant[]; // 완료 여부는 서버가 제공한다.
  registeredPlaceCount: number; // 방의 장소 수. 참여 인원 수와 구분.
}
export interface RegisterPlaceRequest {
  roomId: string;
  placeId: string;
}
export interface ExplorationRepository {
  load(signal: AbortSignal): Promise<ExplorationSnapshot>;
  register(request: RegisterPlaceRequest, signal: AbortSignal): Promise<ExplorationSnapshot>;
}
export interface ExplorationStatusPreview {
  source: 'place-exploration-preview';
  participants: RegistrationParticipant[];
  deadline: number;
  registeredPlaceCount: number;
}
