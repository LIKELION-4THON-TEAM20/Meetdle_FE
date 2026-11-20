import { getSession } from '../../api/auth';
import { ApiRequestError } from '../../api/client';
import { getRoomState, isServerRoomId, roomMutations, searchPlaces } from '../../api/rooms';
import { toUiCategory } from '../../api/mappers';
import type {
  Category,
  Place,
  PlaceSearchItem,
  PlaceSearchResponse,
  RoomState,
} from '../../api/types';
import type { RecommendedPlace } from './types';

// Display identity only. This value is never sent in place of a server pickToken.
export const placeKey = (place: Place) =>
  JSON.stringify([place.category, place.name, place.address, place.lat, place.lng]);
export const categoryLabels: Record<Category, string> = {
  FOOD: '식당',
  CAFE: '카페',
  BAR: '주점',
  CULTURE: '문화시설',
};
export function displayPlace(place: Place, item?: PlaceSearchItem): RecommendedPlace {
  return {
    id: placeKey(place),
    name: place.name,
    address: place.address,
    categoryId: toUiCategory[place.category],
    coordinates: { latitude: place.lat, longitude: place.lng },
    distanceMeters: item?.distanceMeters,
    ...(typeof place.imageUrl === 'string' ? { imageUrl: place.imageUrl } : {}),
    kakaoPlaceId: null,
    kakaoMapUrl: place.detailUrl,
    eligible: !!item?.registrable && !!item.pickToken,
  };
}
export function registrationEditable(state: RoomState, now: number) {
  const r = state.registration;
  return (
    !!r &&
    state.phase === 'PLACE_SUBMISSION_OPEN' &&
    !r.closedAt &&
    !r.myCompleted &&
    state.me.canRegister &&
    now < Date.parse(r.closesAt)
  );
}
export function registeredCandidates(state: RoomState) {
  const candidates = state.registration?.myCandidates;
  if (
    !Array.isArray(candidates) ||
    candidates.some(
      (c) => !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(c.candidateId) || !c.place,
    )
  )
    throw new TypeError('Expected registration.myCandidates with server candidate IDs');
  return candidates;
}
export function canCompleteRegistration(state: RoomState) {
  return !!state.registration && registeredCandidates(state).length > 0;
}

export function createApiExplorationRepository(roomId: string) {
  if (!isServerRoomId(roomId)) throw new TypeError('Expected a server room UUID');
  let current: RoomState | undefined;
  let searchGeneration = 0;
  let owner: Awaited<ReturnType<typeof getSession>> | undefined;
  async function assertOwner() {
    const session = await getSession();
    if (
      !owner ||
      session.user.userId !== owner.user.userId ||
      session.csrfToken !== owner.csrfToken
    )
      throw new ApiRequestError(null, { code: 'SESSION_CHANGED', message: 'Session changed' });
  }
  const picks = new Map<string, PlaceSearchItem>();
  let mutation: { execute(): Promise<RoomState> } | undefined;
  async function load(signal?: AbortSignal) {
    const state = await getRoomState(roomId, signal);
    signal?.throwIfAborted();
    if (state.roomId !== roomId) throw new TypeError('Room response mismatch');
    if (state.registration) registeredCandidates(state);
    await assertOwner();
    signal?.throwIfAborted();
    current = state;
    searchGeneration++;
    picks.clear();
    return state;
  }
  function stateForEdit(action: 'EDIT_NOMINATION' | 'COMPLETE_COLLECTION', now: number) {
    if (
      !current ||
      !registrationEditable(current, now) ||
      !current.allowedActions.includes(action)
    ) {
      throw new Error('현재 상태에서는 등록 내용을 변경할 수 없어요. 최신 상태를 확인해주세요.');
    }
    return current;
  }
  function makeMutation(
    state: RoomState,
    handle: { execute(): Promise<unknown> },
    matches: (fresh: RoomState) => boolean,
    accepted?: (response: unknown) => void,
  ) {
    if (mutation) throw new Error('이전 요청의 결과를 먼저 확인해주세요.');
    let attempted = false;
    let rejected: unknown;
    let pending: Promise<RoomState> | undefined;
    mutation = {
      execute() {
        if (pending) return pending;
        pending = (async () => {
          await assertOwner();
          if (!attempted) {
            attempted = true;
            try {
              const response = await handle.execute();
              accepted?.(response);
            } catch (error) {
              if (
                !(error instanceof ApiRequestError) ||
                (error.status !== null && error.status >= 400 && error.status < 500)
              )
                rejected = error;
              throw error;
            }
          }
          const fresh = await load();
          if (rejected) throw rejected;
          if (fresh.registration?.round !== state.registration!.round || !matches(fresh)) {
            throw new Error('서버의 등록 상태가 요청과 달라요. 최신 상태를 다시 확인해주세요.');
          }
          mutation = undefined;
          return fresh;
        })().finally(() => {
          pending = undefined;
        });
        return pending;
      },
    };
    return mutation;
  }
  return {
    async open(signal?: AbortSignal) {
      owner = await getSession({ refresh: true });
      signal?.throwIfAborted();
      const fresh = await load(signal);
      mutation = undefined;
      return fresh;
    },
    // Explicitly reviewing fresh state abandons a failed intent; it never repeats its PUT.
    async reload(signal?: AbortSignal) {
      const fresh = await load(signal);
      mutation = undefined;
      return fresh;
    },
    async search(
      category: Category,
      q: string,
      page = 1,
      signal?: AbortSignal,
    ): Promise<PlaceSearchResponse> {
      const state = current;
      if (!state?.allowedActions.includes('SEARCH_PLACES'))
        throw new Error('현재 방에서는 장소를 검색할 수 없어요.');
      if (!state.registration?.categories.some((c) => c.category === category))
        throw new Error('현재 회차의 카테고리가 아니에요.');
      const query = q.trim();
      if (query.length > 60) throw new Error('검색어는 60자 이내로 입력해주세요.');
      if (!Number.isInteger(page) || page < 1 || page > 3)
        throw new TypeError('Invalid search page');
      if (page === 1) {
        searchGeneration++;
        picks.clear();
      }
      const generation = searchGeneration;
      const result = await searchPlaces(
        roomId,
        { category, ...(query ? { q: query } : {}), page },
        signal,
      );
      signal?.throwIfAborted();
      if (generation !== searchGeneration || current !== state)
        throw new DOMException('Superseded', 'AbortError');
      if (
        !Number.isFinite(result.radiusMeters) ||
        result.radiusMeters <= 0 ||
        !Array.isArray(result.items) ||
        !(
          result.nextPage === null ||
          (Number.isInteger(result.nextPage) && result.nextPage! > page && result.nextPage! <= 3)
        ) ||
        result.items.some((item) => item.place.category !== category)
      )
        throw new TypeError('Invalid place search response');
      if (!result.available) picks.clear();
      else for (const item of result.items) picks.set(placeKey(item.place), item);
      return result;
    },
    nominate(category: Category, key: string, now: number) {
      const state = stateForEdit('EDIT_NOMINATION', now);
      const item = picks.get(key);
      if (
        !state.registration!.categories.some((c) => c.category === category && c.available) ||
        item?.place.category !== category ||
        !item.registrable ||
        !item.pickToken
      ) {
        throw new Error('등록 가능한 검색 결과를 다시 선택해주세요.');
      }
      let candidateId: string | undefined;
      return makeMutation(
        state,
        roomMutations.addCandidate(roomId, {
          round: state.registration!.round,
          category,
          pickToken: item.pickToken,
        }),
        (fresh) =>
          registeredCandidates(fresh).some(
            (c) => placeKey(c.place) === key && (!candidateId || c.candidateId === candidateId),
          ),
        (response) => {
          const id = (response as { candidateId?: unknown })?.candidateId;
          if (typeof id !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id))
            throw new TypeError('Expected added candidate ID');
          candidateId = id;
        },
      );
    },
    withdraw(candidateId: string, now: number) {
      const state = stateForEdit('EDIT_NOMINATION', now);
      if (!registeredCandidates(state).some((c) => c.candidateId === candidateId))
        throw new Error('철회할 본인 후보가 없어요.');
      return makeMutation(
        state,
        roomMutations.removeCandidate(roomId, candidateId, state.registration!.round),
        (fresh) => !registeredCandidates(fresh).some((c) => c.candidateId === candidateId),
      );
    },
    complete(now: number) {
      const state = stateForEdit('COMPLETE_COLLECTION', now);
      if (!canCompleteRegistration(state)) throw new Error('장소 후보를 한 곳 이상 등록해주세요.');
      return makeMutation(
        state,
        roomMutations.completeRegistration(roomId, { round: state.registration!.round }),
        (fresh) => fresh.registration?.myCompleted === true,
      );
    },
  };
}
export type ApiExplorationRepository = ReturnType<typeof createApiExplorationRepository>;
