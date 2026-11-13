import type { VoteCategory, VoteResponses, VoteState } from '../../pages/PlaceVote/types';
import { voteCategories } from '../../pages/PlaceVote/mockData';
import { getVoteProgress, updateVote, type VoteAction } from '../../pages/PlaceVote/voteUtils';
import type { ResultPlace, ResultRole, ResultState } from '../../pages/VoteResult/types';
import { saveVisitOrder } from '../../pages/VoteResult/resultUtils';
import { isValidVoteDeadline } from '../../pages/VoteStart/voteUtils';
import { extendRegistrationDeadline } from '../../pages/PlaceRegistrationStatus/statusUtils';
import type { CandidateCategory } from '../../pages/VoteStart/mockData';

export const STORAGE_KEY = 'meetdle:development-mock-room:v1';
export const HOUR = 3600000;
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
  status: 'completed' | 'inProgress' | 'notStarted';
  vote: VoteState;
}
export interface MockRoom {
  version: 1;
  id: string;
  name: string;
  meetingAt: number;
  area: string;
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

export function createMockRoom(now: number): MockRoom {
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
    id: 'mock-room-10-14',
    name: '11월 동기 모임 (목 데이터)',
    meetingAt: now + 12 * HOUR,
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
  return room.categories.map((category) => ({
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
  return (
    room.categories.some((category) => category.places.length > 0) &&
    room.categories.every((category) => !category.required || category.places.length > 0)
  );
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
  for (const category of room.categories) {
    if (!category.places.length) continue;
    const places: ResultPlace[] = category.places.map((place) => {
      const votes = { like: 0, neutral: 0, dislike: 0 };
      if (category.places.length > 1)
        ballots.forEach(({ vote }) => {
          votes[vote.responses[place.id]] += 1;
        });
      return { ...place, votes, tieVotes: votes.like };
    });
    const eligible = places.filter((place) => place.votes.dislike <= ballots.length / 2);
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
  | { type: 'deadline'; deadline: number; now: number }
  | { type: 'tick'; now: number }
  | { type: 'extend'; minutes: number; now: number }
  | { type: 'closeRegistration' }
  | { type: 'start'; deadline: number; now: number }
  | { type: 'vote'; action: VoteAction }
  | { type: 'closeVote'; now: number }
  | { type: 'count'; now: number }
  | { type: 'tie'; categoryId: string; placeId: string }
  | { type: 'order'; order: string[] }
  | { type: 'revoteNotice' };

export function reduceRoom(room: MockRoom, action: Action): MockRoom {
  const host = room.role === 'host';
  switch (action.type) {
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
    case 'tick': {
      if (room.phase !== 'voting') return room;
      const count = completedVoters(room).length;
      return count === room.participants.length || action.now >= room.voteDeadline
        ? { ...room, phase: count > room.participants.length / 2 ? 'counting' : 'insufficient' }
        : room;
    }
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
    case 'closeRegistration':
      return host && room.phase === 'registration' && validCandidates(room)
        ? { ...room, registrationClosed: true }
        : room;
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
      return host && room.phase === 'voting' && action.now < room.voteDeadline
        ? {
            ...room,
            closedEarly: true,
            phase:
              completedVoters(room).length > room.participants.length / 2
                ? 'counting'
                : 'insufficient',
          }
        : room;
    case 'count':
      return room.result ? room : aggregate(room, action.now);
    case 'tie': {
      const tie = room.ties.find(({ id }) => id === action.categoryId);
      const place = tie?.places.find(({ id }) => id === action.placeId);
      if (!host || !room.result || !place) return room;
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
    case 'order':
      return host && room.result && !room.result.unresolvedTie
        ? { ...room, result: saveVisitOrder(room.result, action.order, room.role) }
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

// Validate the complete persisted shape and vote references before trusting session data.
export function isMockRoom(value: unknown): value is MockRoom {
  if (!value || typeof value !== 'object') return false;
  const room = value as MockRoom;
  try {
    if (
      room.version !== 1 ||
      room.id !== 'mock-room-10-14' ||
      typeof room.name !== 'string' ||
      typeof room.area !== 'string' ||
      ![room.meetingAt, room.registrationDeadline, room.voteDeadline].every(Number.isFinite) ||
      !['registration', 'voting', 'counting', 'result', 'insufficient'].includes(room.phase) ||
      !['host', 'participant'].includes(room.role) ||
      typeof room.registrationClosed !== 'boolean' ||
      typeof room.closedEarly !== 'boolean' ||
      !Array.isArray(room.categories) ||
      room.categories.length !== 4 ||
      !Array.isArray(room.participants) ||
      room.participants.length !== 4 ||
      !Array.isArray(room.ties)
    )
      return false;
    const ids = new Set<string>();
    for (const category of room.categories) {
      if (
        !categoryId(category.id) ||
        categoryId(category.id) !== category.id ||
        ids.has(category.id) ||
        typeof category.name !== 'string' ||
        category.required !== ['restaurant', 'cafe'].includes(category.id) ||
        !Array.isArray(category.places)
      )
        return false;
      ids.add(category.id);
      for (const place of category.places) {
        if (
          typeof place.id !== 'string' ||
          ids.has(place.id) ||
          typeof place.name !== 'string' ||
          typeof place.address !== 'string' ||
          !Number.isFinite(place.distanceMeters)
        )
          return false;
        ids.add(place.id);
      }
    }
    const people = new Set<string>();
    for (const participant of room.participants) {
      if (
        !['sangmin', 'jieun', 'haneul', 'yujin'].includes(participant.id) ||
        people.has(participant.id) ||
        typeof participant.name !== 'string' ||
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
        ![0, 1].includes(room.result.revotesUsed)
      )
        return false;
      const resultIds = new Set<string>();
      for (const category of room.result.categories) {
        if (resultIds.has(category.id)) return false;
        resultIds.add(category.id);
        if (
          !room.categories.some(
            ({ id, places }) =>
              id === category.id && places.some(({ id }) => id === category.place.id),
          ) ||
          !['like', 'neutral', 'dislike'].every(
            (key) =>
              Number.isInteger(category.place.votes[key as keyof typeof category.place.votes]) &&
              category.place.votes[key as keyof typeof category.place.votes] >= 0,
          )
        )
          return false;
      }
      if (
        room.result.order.length !== room.result.categories.length ||
        new Set(room.result.order).size !== room.result.order.length ||
        room.result.order.some(
          (id) => !room.result!.categories.some((category) => category.id === id),
        )
      )
        return false;
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
          room.categories.some(({ id }) => id === tie.id) &&
          Array.isArray(tie.places) &&
          tie.places.length > 1 &&
          tie.places.every((place) => ids.has(place.id)),
      )
    );
  } catch {
    return false;
  }
}

export function restoreRoom(storage: Pick<Storage, 'getItem'>, now: number): MockRoom {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null');
    if (isMockRoom(parsed)) return parsed;
  } catch {
    /* Storage can be unavailable. */
  }
  return createMockRoom(now);
}
