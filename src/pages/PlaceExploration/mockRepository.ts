import { createExplorationMock } from './mockData';
import { missingRequiredCategories, registrationBlock } from './placeUtils';
import type { ExplorationRepository, ExplorationSnapshot } from './types';

function delay(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, 350);
    signal.addEventListener('abort', abort, { once: true });
  });
}
export function createMockExplorationRepository(
  initial = createExplorationMock(),
  scenario: string | null = null,
): ExplorationRepository {
  let current: ExplorationSnapshot = structuredClone(initial);
  let failLoad = scenario === 'loadError';
  let failRegistration = scenario === 'registerError';
  if (scenario === 'empty') current.recommendations = [];
  if (scenario === 'emptyCulture')
    current.recommendations = current.recommendations.filter(
      (place) => place.categoryId !== 'culture',
    );
  if (scenario === 'expanded')
    current.area = {
      ...current.area,
      radiusMeters: 3000,
      expansionMessage: '선택할 수 있는 장소가 적어 탐색 범위를 3km로 넓혔어요.',
    };
  if (scenario === 'outside')
    current.recommendations.push({
      ...current.recommendations.find((place) => place.categoryId === 'cafe')!,
      id: 'outside-cafe',
      name: 'C 카페',
      coordinates: { latitude: 37.594, longitude: 127.038 },
      distanceMeters: 3100,
      eligible: false,
    });
  if (scenario === 'closed') current.registrationOpen = false;
  return {
    async load(signal) {
      await delay(signal);
      signal.throwIfAborted();
      if (failLoad) {
        failLoad = false;
        throw new Error('추천 장소를 불러오지 못했어요.');
      }
      return structuredClone(current);
    },
    async register(request, signal) {
      await delay(signal);
      signal.throwIfAborted();
      if (failRegistration) {
        failRegistration = false;
        throw new Error('목 등록 요청에 실패했어요. 다시 시도해주세요.');
      }
      if (request.roomId !== current.roomId) throw new Error('약속방 정보를 확인해주세요.');
      const place = current.recommendations.find((item) => item.id === request.placeId);
      if (!place) throw new Error('추천 장소 정보를 다시 확인해주세요.');
      const blocked = registrationBlock(current, place, Date.now());
      if (blocked) throw new Error(blocked);
      // 원본 응답을 복사한 목 상태만 바꾼다. 서버/다른 탭에는 저장되지 않는다.
      const wasAlreadyCandidate = current.registrations.some((entry) => entry.placeId === place.id);
      current = {
        ...current,
        registrations: [
          ...current.registrations,
          {
            id: `preview-${place.id}`,
            userId: current.currentUserId,
            placeId: place.id,
            categoryId: place.categoryId,
          },
        ],
        registeredPlaceCount: current.registeredPlaceCount + (wasAlreadyCandidate ? 0 : 1),
      };
      // 장소 등록과 사용자의 등록 완료 확인은 별도 단계다.
      current.participants = current.participants.map((entry) =>
        entry.id === current.currentUserId ? { ...entry, status: 'inProgress' } : entry,
      );
      return structuredClone(current);
    },
    async complete(roomId, signal) {
      await delay(signal);
      signal.throwIfAborted();
      if (roomId !== current.roomId) throw new Error('약속방 정보를 확인해주세요.');
      if (!current.registrationOpen || Date.now() >= current.deadline)
        throw new Error('장소 등록이 마감됐어요.');
      if (missingRequiredCategories(current).length)
        throw new Error('필수 카테고리의 장소를 선택해주세요.');
      current = {
        ...current,
        participants: current.participants.map((entry) =>
          entry.id === current.currentUserId ? { ...entry, status: 'completed' } : entry,
        ),
      };
      return structuredClone(current);
    },
  };
}

// 기존 SCREEN 10–14 목 방과 분리된 현재 탭의 메모리 미리보기다.
export const mockExplorationRepository = createMockExplorationRepository();
