import type {
  VoteCategory,
  VotePlace,
  VoteResponses,
  VoteState,
} from '../../pages/PlaceVote/types';
import { voteCategories } from '../../pages/PlaceVote/mockData';
import { getVoteProgress, updateVote, type VoteAction } from '../../pages/PlaceVote/voteUtils';
import type { ResultPlace, ResultRole, ResultState } from '../../pages/VoteResult/types';
import { isValidVisitOrder, saveVisitOrder } from '../../pages/VoteResult/resultUtils';
import { isValidVoteDeadline } from '../../pages/VoteStart/voteUtils';
import {
  extendRegistrationDeadline,
  isValidRegistrationExtension,
} from '../../pages/PlaceRegistrationStatus/statusUtils';
import type { CandidateCategory } from '../../pages/VoteStart/mockData';
import { isValidDeadline } from '../../pages/PlaceRegistrationSetup/deadlineUtils';
import { CATEGORIES, REGISTRATION_RULES } from '../../pages/PlaceRegistrationSetup/mockData';

export const STORAGE_KEY = 'meetdle:development-mock-room:v1';
export const HOUR = 3600000;
export const MOCK_MEETING_LEAD_TIME = 7 * 24 * HOUR;
export interface ConfirmedSelection {
  endsAt: number;
  availableCount: number;
  averageTravelMinutes: number;
  maximumTravelMinutes: number;
  averageTransfers: number;
}
export type CategoryId = 'restaurant' | 'cafe' | 'pub' | 'culture';
export function categoryId(id: string): CategoryId | undefined {
  return (
    {
      '0': 'restaurant',
      '1': 'cafe',
      '2': 'pub',
      '3': 'culture',
      bar: 'pub',
      restaurant: 'restaurant',
      cafe: 'cafe',
      pub: 'pub',
      culture: 'culture',
    } as Record<string, CategoryId>
  )[id];
}
export interface MockCategory extends VoteCategory {
  id: CategoryId;
  required: boolean;
}
export interface MockParticipant {
  id: string;
  name: string;
  profileImageUrl?: string;
  registrationStatus?: MockParticipant['status'];
  status: 'completed' | 'inProgress' | 'notStarted';
  vote: VoteState;
}
export interface MockRoom {
  version: 1;
  id: string;
  name: string;
  meetingAt: number;
  area: string;
  confirmation?: ConfirmedSelection;
  registrationStarted?: boolean;
  registrationCategoryIds?: CategoryId[];
  registrationDeadline: number;
  registrationClosed: boolean;
  voteDeadline: number;
  phase: 'registration' | 'voting' | 'counting' | 'result' | 'insufficient';
  closedEarly: boolean;
  role: ResultRole;
  currentUserId: string;
  participants: MockParticipant[];
  categories: MockCategory[];
  result: ResultState | null;
  ties: { id: CategoryId; name: string; places: ResultPlace[] }[];
}

export function createMockRoom(now: number, id = 'mock-room-10-14'): MockRoom {
  const categories: MockCategory[] = voteCategories.map((category) => ({
    ...category,
    id: categoryId(category.id)!,
    required: ['restaurant', 'cafe'].includes(category.id),
    places: category.places.map((place) => ({ ...place })),
  }));
  const sampleResponses: VoteResponses = {};
  categories
    .filter((category) => category.places.length > 1)
    .forEach((category) => {
      category.places.forEach((place, index) => {
        sampleResponses[place.id] = index === 0 ? 'like' : 'neutral';
      });
    });
  return {
    version: 1,
    id,
    name: '11월 동기 모임 (목 데이터)',
    // 등록·투표 UI를 여유 있게 확인할 수 있도록 새 목 방은 일주일 뒤로 시작한다.
    meetingAt: now + MOCK_MEETING_LEAD_TIME,
    area: '왕십리역 근처',
    registrationDeadline: now + 2 * HOUR,
    registrationClosed: false,
    voteDeadline: Math.ceil((now + 2 * HOUR) / 60000) * 60000,
    phase: 'registration',
    closedEarly: false,
    role: 'host',
    currentUserId: 'sangmin',
    participants: ['상민', '지은', '하늘', '유진'].map((name, index) => ({
      id: ['sangmin', 'jieun', 'haneul', 'yujin'][index],
      name,
      status: index === 2 ? 'inProgress' : 'completed',
      registrationStatus: index < 2 ? 'completed' : index === 2 ? 'inProgress' : 'notStarted',
      vote: {
        submitted: index === 1 || index === 3,
        responses: index === 1 || index === 3 ? { ...sampleResponses } : {},
      },
    })),
    categories,
    result: null,
    ties: [],
  };
}

export function candidateCategories(room: MockRoom): CandidateCategory[] {
  return room.categories
    .filter(({ id }) => !room.registrationCategoryIds || room.registrationCategoryIds.includes(id))
    .map((category) => ({
      id: category.id,
      name: category.name,
      required: category.required,
      candidates: category.places.map((place) => ({ id: place.id, valid: true })),
      autoSelected: category.places.length === 1,
    }));
}
export function currentVote(room: MockRoom) {
  return room.participants.find((participant) => participant.id === room.currentUserId)!.vote;
}
export function validCandidates(room: MockRoom) {
  const categories = candidateCategories(room);
  return (
    categories.some((category) => category.candidates.length > 0) &&
    categories.every((category) => !category.required || category.candidates.length > 0)
  );
}

export function registrationParticipants(room: MockRoom) {
  return room.participants.map((participant) => ({
    ...participant,
    status: participant.registrationStatus ?? participant.status,
  }));
}
export function completedVoters(room: MockRoom) {
  return room.participants.filter(
    (participant) =>
      participant.vote.submitted &&
      (getVoteProgress(room.categories, participant.vote.responses).complete ||
        room.categories.every((category) => category.places.length <= 1)),
  );
}
export function canCount(room: MockRoom, now: number) {
  const count = completedVoters(room).length;
  return (
    count > room.participants.length / 2 &&
    (count === room.participants.length || room.closedEarly || now >= room.voteDeadline)
  );
}

export function resultCandidates(room: MockRoom) {
  const ballots = completedVoters(room);
  return room.categories.map((category) => ({
    ...category,
    places: category.places.map((place): ResultPlace => {
      const votes = { like: 0, neutral: 0, dislike: 0 };
      if (category.places.length > 1)
        ballots.forEach(({ vote }) => {
          votes[vote.responses[place.id]] += 1;
        });
      return { ...place, votes, tieVotes: votes.like };
    }),
  }));
}

export function resultTieOptions(room: MockRoom) {
  return room.result?.unresolvedTie || room.result?.categories.length
    ? aggregate(room, room.voteDeadline).ties
    : [];
}

export function canFinalizeResult(room: MockRoom) {
  const result = room.result;
  return Boolean(
    room.phase === 'result' &&
    result?.categories.length &&
    !result.unresolvedTie &&
    room.ties.length === 0 &&
    new Set(result.categories.map(({ place }) => place.id)).size === result.categories.length &&
    candidateCategories(room).every(
      (category) => !category.required || result.categories.some(({ id }) => id === category.id),
    ) &&
    isValidVisitOrder(result, result.order),
  );
}

// Development simulation only, not a product/backend ranking contract.
// Rank by like - dislike; exclude a strict majority of dislikes. Keep every tie unresolved.
export function aggregate(room: MockRoom, now: number): MockRoom {
  if (
    !room.registrationClosed ||
    room.phase === 'registration' ||
    !validCandidates(room) ||
    !canCount(room, now)
  )
    return room;
  const ballots = completedVoters(room);
  const categories: ResultState['categories'] = [];
  const ties: MockRoom['ties'] = [];
  for (const category of resultCandidates(room)) {
    if (!category.places.length) continue;
    const eligible = category.places.filter((place) => place.votes.dislike <= ballots.length / 2);
    if (!eligible.length)
      return {
        ...room,
        phase: 'result',
        result: { categories: [], order: [], unresolvedTie: false, revotesUsed: 0 },
        ties: [],
      };
    const best = Math.max(...eligible.map((place) => place.votes.like - place.votes.dislike));
    const winners = eligible.filter((place) => place.votes.like - place.votes.dislike === best);
    categories.push({ id: category.id, name: category.name, place: winners[0] });
    if (winners.length > 1) ties.push({ id: category.id, name: category.name, places: winners });
  }
  return {
    ...room,
    phase: 'result',
    ties,
    result: {
      categories,
      order: categories.map(({ id }) => id),
      unresolvedTie: ties.length > 0,
      revotesUsed: 0,
    },
  };
}

export type Action =
  | { type: 'startRegistration'; categoryIds: CategoryId[]; deadline: number; now: number }
  | { type: 'deadline'; deadline: number; now: number }
  | { type: 'extendVote'; deadline: number; now: number }
  | { type: 'extend'; minutes: number; now: number }
  | { type: 'extendRegistration'; deadline: number; now: number }
  | { type: 'closeRegistration' }
  | { type: 'start'; deadline: number; now: number }
  | { type: 'vote'; action: VoteAction }
  | { type: 'closeVote'; now: number }
  | { type: 'count'; now: number }
  | { type: 'tie'; categoryId: string; placeId: string }
  | { type: 'order'; order: string[] }
  | { type: 'finalizeResult' }
  | { type: 'revoteNotice' };

export function validRegistrationCategories(ids: readonly CategoryId[]): boolean {
  return (
    ids.length >= REGISTRATION_RULES.minimumPlacesPerPerson &&
    new Set(ids).size === ids.length &&
    ids.every((id) => CATEGORIES.some((category) => category.id === id)) &&
    CATEGORIES.every((category) => !category.required || ids.includes(category.id))
  );
}

export function reduceRoom(room: MockRoom, action: Action): MockRoom {
  const host = room.role === 'host';
  switch (action.type) {
    case 'startRegistration':
      return host &&
        room.phase === 'registration' &&
        !room.registrationClosed &&
        !room.registrationStarted &&
        validRegistrationCategories(action.categoryIds) &&
        isValidDeadline(action.deadline, action.now, room.meetingAt)
        ? {
            ...room,
            registrationStarted: true,
            registrationCategoryIds: [...action.categoryIds],
            registrationDeadline: action.deadline,
          }
        : room;
    case 'deadline':
      return host &&
        room.phase === 'registration' &&
        room.registrationClosed &&
        isValidVoteDeadline(
          new Date(action.deadline),
          new Date(action.now),
          new Date(room.meetingAt),
        )
        ? { ...room, voteDeadline: action.deadline }
        : room;
    case 'extendVote':
      return host &&
        room.phase === 'voting' &&
        action.now >= room.voteDeadline &&
        action.deadline > room.voteDeadline &&
        isValidVoteDeadline(
          new Date(action.deadline),
          new Date(action.now),
          new Date(room.meetingAt),
        )
        ? { ...room, voteDeadline: action.deadline }
        : room;
    case 'extend': {
      const deadline = extendRegistrationDeadline(
        room.registrationDeadline,
        action.minutes,
        action.now,
      );
      return host && !room.registrationClosed && deadline !== null
        ? { ...room, registrationDeadline: deadline }
        : room;
    }
    case 'extendRegistration':
      return host &&
        room.phase === 'registration' &&
        !room.registrationClosed &&
        room.registrationStarted !== false &&
        isValidRegistrationExtension(
          action.deadline,
          room.registrationDeadline,
          action.now,
          room.meetingAt,
        )
        ? { ...room, registrationDeadline: action.deadline }
        : room;
    case 'closeRegistration': {
      if (
        !host ||
        room.phase !== 'registration' ||
        room.registrationClosed ||
        room.registrationStarted === false ||
        !validCandidates(room)
      )
        return room;
      const categories = room.categories.filter(
        ({ id }) => !room.registrationCategoryIds || room.registrationCategoryIds.includes(id),
      );
      if (categories.length === room.categories.length)
        return { ...room, registrationClosed: true };
      const allowedIds = new Set(categories.flatMap(({ places }) => places.map(({ id }) => id)));
      return {
        ...room,
        categories,
        registrationClosed: true,
        participants: room.participants.map((participant) => ({
          ...participant,
          vote: {
            ...participant.vote,
            responses: Object.fromEntries(
              Object.entries(participant.vote.responses).filter(([id]) => allowedIds.has(id)),
            ),
          },
        })),
      };
    }
    case 'start':
      return host &&
        room.phase === 'registration' &&
        room.registrationClosed &&
        validCandidates(room) &&
        isValidVoteDeadline(
          new Date(action.deadline),
          new Date(action.now),
          new Date(room.meetingAt),
        )
        ? { ...room, voteDeadline: action.deadline, phase: 'voting' }
        : room;
    case 'vote': {
      if (room.phase !== 'voting') return room;
      const previous = currentVote(room);
      const allAutomatic =
        validCandidates(room) && room.categories.every((category) => category.places.length <= 1);
      const next =
        allAutomatic &&
        action.action.type === 'submit' &&
        !previous.submitted &&
        action.action.now < room.voteDeadline
          ? { ...previous, submitted: true }
          : updateVote(previous, action.action, room.categories, room.voteDeadline);
      return next === previous
        ? room
        : {
            ...room,
            participants: room.participants.map((participant) =>
              participant.id === room.currentUserId ? { ...participant, vote: next } : participant,
            ),
          };
    }
    case 'closeVote':
      return host &&
        room.phase === 'voting' &&
        completedVoters(room).length > room.participants.length / 2
        ? {
            ...room,
            closedEarly: action.now < room.voteDeadline,
            phase: 'counting',
          }
        : room;
    case 'count':
      return host && room.phase === 'counting' ? aggregate(room, action.now) : room;
    case 'tie': {
      if (!host || !room.result || room.result.finalized) return room;
      const tie = resultTieOptions(room).find(({ id }) => id === action.categoryId);
      const place = tie?.places.find(({ id }) => id === action.placeId);
      if (!place) return room;
      const ties = room.ties.filter(({ id }) => id !== action.categoryId);
      return {
        ...room,
        ties,
        result: {
          ...room.result,
          unresolvedTie: ties.length > 0,
          categories: room.result.categories.map((category) =>
            category.id === action.categoryId ? { ...category, place } : category,
          ),
        },
      };
    }
    case 'order': {
      if (!host || !room.result || room.result.finalized || room.result.unresolvedTie) return room;
      const result = saveVisitOrder(room.result, action.order, room.role);
      return result === room.result ? room : { ...room, result };
    }
    case 'finalizeResult':
      return host && room.result && !room.result.finalized && canFinalizeResult(room)
        ? { ...room, result: { ...room.result, finalized: true } }
        : room;
    case 'revoteNotice':
      return host &&
        room.result &&
        room.result.categories.length === 0 &&
        room.result.revotesUsed < 1
        ? { ...room, result: { ...room.result, revotesUsed: room.result.revotesUsed + 1 } }
        : room;
  }
}

function isVotePlace(place: VotePlace): boolean {
  return (
    place !== null &&
    typeof place === 'object' &&
    typeof place.id === 'string' &&
    typeof place.name === 'string' &&
    typeof place.address === 'string' &&
    Number.isFinite(place.distanceMeters) &&
    (place.kakaoMapUrl === undefined || typeof place.kakaoMapUrl === 'string')
  );
}

function isResultPlace(place: ResultPlace): boolean {
  return (
    isVotePlace(place) &&
    (place.tieVotes === undefined || (Number.isInteger(place.tieVotes) && place.tieVotes >= 0)) &&
    place.votes !== null &&
    typeof place.votes === 'object' &&
    (['like', 'neutral', 'dislike'] as const).every(
      (key) => Number.isInteger(place.votes[key]) && place.votes[key] >= 0,
    )
  );
}

// Validate the complete persisted shape and vote references before trusting session data.
export function isMockRoom(value: unknown, id = 'mock-room-10-14'): value is MockRoom {
  if (!value || typeof value !== 'object') return false;
  const room = value as MockRoom;
  try {
    if (
      room.version !== 1 ||
      room.id !== id ||
      typeof room.name !== 'string' ||
      typeof room.area !== 'string' ||
      ![room.meetingAt, room.registrationDeadline, room.voteDeadline].every(Number.isFinite) ||
      !['registration', 'voting', 'counting', 'result', 'insufficient'].includes(room.phase) ||
      !['host', 'participant'].includes(room.role) ||
      typeof room.registrationClosed !== 'boolean' ||
      typeof room.closedEarly !== 'boolean' ||
      !Array.isArray(room.categories) ||
      room.categories.length !==
        (room.registrationClosed && Array.isArray(room.registrationCategoryIds)
          ? room.registrationCategoryIds.length
          : 4) ||
      !Array.isArray(room.participants) ||
      room.participants.length !== 4 ||
      !Array.isArray(room.ties)
    )
      return false;
    if (room.registrationStarted !== undefined && typeof room.registrationStarted !== 'boolean')
      return false;
    if (
      room.registrationCategoryIds !== undefined &&
      (room.registrationStarted !== true ||
        !Array.isArray(room.registrationCategoryIds) ||
        !validRegistrationCategories(room.registrationCategoryIds))
    )
      return false;
    const confirmation = room.confirmation;
    if (
      confirmation !== undefined &&
      (!confirmation ||
        !Number.isFinite(confirmation.endsAt) ||
        confirmation.endsAt <= room.meetingAt ||
        !Number.isInteger(confirmation.availableCount) ||
        confirmation.availableCount < 0 ||
        confirmation.availableCount > room.participants.length ||
        ![
          confirmation.averageTravelMinutes,
          confirmation.maximumTravelMinutes,
          confirmation.averageTransfers,
        ].every((value) => Number.isFinite(value) && value >= 0))
    )
      return false;
    const ids = new Set<string>();
    for (const category of room.categories) {
      if (
        !categoryId(category.id) ||
        categoryId(category.id) !== category.id ||
        ids.has(category.id) ||
        (room.registrationClosed &&
          room.registrationCategoryIds &&
          !room.registrationCategoryIds.includes(category.id)) ||
        typeof category.name !== 'string' ||
        category.required !== ['restaurant', 'cafe'].includes(category.id) ||
        !Array.isArray(category.places)
      )
        return false;
      ids.add(category.id);
      for (const place of category.places) {
        if (!isVotePlace(place) || ids.has(place.id)) return false;
        ids.add(place.id);
      }
    }
    const people = new Set<string>();
    for (const participant of room.participants) {
      if (
        !['sangmin', 'jieun', 'haneul', 'yujin'].includes(participant.id) ||
        people.has(participant.id) ||
        typeof participant.name !== 'string' ||
        (participant.profileImageUrl !== undefined &&
          typeof participant.profileImageUrl !== 'string') ||
        (participant.registrationStatus !== undefined &&
          !['completed', 'inProgress', 'notStarted'].includes(participant.registrationStatus)) ||
        !['completed', 'inProgress', 'notStarted'].includes(participant.status) ||
        typeof participant.vote.submitted !== 'boolean' ||
        !participant.vote.responses ||
        typeof participant.vote.responses !== 'object' ||
        Object.entries(participant.vote.responses).some(
          ([id, choice]) =>
            !room.categories.some(
              ({ places }) => places.length > 1 && places.some((place) => place.id === id),
            ) || !['like', 'neutral', 'dislike'].includes(choice),
        )
      )
        return false;
      people.add(participant.id);
    }
    if (!people.has(room.currentUserId)) return false;
    if (room.currentUserId !== (room.role === 'host' ? 'sangmin' : 'haneul')) return false;
    if (room.phase !== 'registration' && !room.registrationClosed) return false;
    if ((room.phase === 'result') !== (room.result !== null)) return false;
    if (room.result !== null) {
      if (
        !Array.isArray(room.result.categories) ||
        !Array.isArray(room.result.order) ||
        typeof room.result.unresolvedTie !== 'boolean' ||
        (room.result.finalized !== undefined && typeof room.result.finalized !== 'boolean') ||
        ![0, 1].includes(room.result.revotesUsed)
      )
        return false;
      const resultIds = new Set<string>();
      for (const category of room.result.categories) {
        if (resultIds.has(category.id)) return false;
        resultIds.add(category.id);
        if (
          typeof category.id !== 'string' ||
          typeof category.name !== 'string' ||
          !isResultPlace(category.place) ||
          !room.categories.some(
            ({ id, places }) =>
              id === category.id && places.some(({ id }) => id === category.place.id),
          )
        )
          return false;
      }
      if (!isValidVisitOrder(room.result, room.result.order)) return false;
      const computed = aggregate({ ...room, result: null }, room.voteDeadline);
      if (!computed.result || computed.result.categories.length !== room.result.categories.length)
        return false;
      for (const category of room.result.categories) {
        const base = computed.result.categories.find(({ id }) => id === category.id);
        const tie = computed.ties.find(({ id }) => id === category.id);
        const possible = tie?.places ?? (base ? [base.place] : []);
        if (
          !possible.some(
            (place) =>
              place.id === category.place.id &&
              JSON.stringify(place.votes) === JSON.stringify(category.place.votes),
          )
        )
          return false;
      }
      if (room.result.unresolvedTie !== room.ties.length > 0) return false;
      if (room.result.finalized && !canFinalizeResult(room)) return false;
      if (
        room.ties.some(
          (tie) =>
            !computed.ties.some((expected) => JSON.stringify(expected) === JSON.stringify(tie)),
        )
      )
        return false;
    }
    return (
      new Set(room.ties.map(({ id }) => id)).size === room.ties.length &&
      room.ties.every(
        (tie) =>
          typeof tie.id === 'string' &&
          typeof tie.name === 'string' &&
          room.categories.some(({ id }) => id === tie.id) &&
          Array.isArray(tie.places) &&
          tie.places.length > 1 &&
          tie.places.every((place) => isResultPlace(place) && ids.has(place.id)),
      )
    );
  } catch {
    return false;
  }
}

function storageKey(id: string) {
  return id === 'mock-room-10-14' ? STORAGE_KEY : `${STORAGE_KEY}:${id}`;
}

export function saveRoom(storage: Pick<Storage, 'setItem'>, room: MockRoom) {
  storage.setItem(storageKey(room.id), JSON.stringify(room));
}

export function restoreRoom(
  storage: Pick<Storage, 'getItem'>,
  now: number,
  id = 'mock-room-10-14',
): MockRoom {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(storageKey(id)) ?? 'null');
    if (isMockRoom(parsed, id)) return parsed;
  } catch {
    /* Storage can be unavailable. */
  }
  return createMockRoom(now, id);
}
