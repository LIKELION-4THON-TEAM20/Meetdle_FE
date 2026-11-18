import type { CategoryId } from '../pages/PlaceRegistrationSetup/types';
import type { VoteChoice } from '../pages/PlaceVote/types';
import type { Category, Preference, RoomRole } from './types';

type UiRole = 'HOST' | 'PARTICIPANT';

export const toApiCategory: Record<CategoryId, Category> = {
  restaurant: 'FOOD',
  cafe: 'CAFE',
  pub: 'BAR',
  culture: 'CULTURE',
};

export const toUiCategory: Record<Category, CategoryId> = {
  FOOD: 'restaurant',
  CAFE: 'cafe',
  BAR: 'pub',
  CULTURE: 'culture',
};

export const toApiRole: Record<UiRole, RoomRole> = { HOST: 'HOST', PARTICIPANT: 'MEMBER' };
export const toUiRole: Record<RoomRole, UiRole> = { HOST: 'HOST', MEMBER: 'PARTICIPANT' };

export const toApiVote: Record<VoteChoice, Preference['choice']> = {
  like: 'LIKE',
  neutral: 'NEUTRAL',
  dislike: 'DISLIKE',
};

export const toUiVote: Record<Preference['choice'], VoteChoice> = {
  LIKE: 'like',
  NEUTRAL: 'neutral',
  DISLIKE: 'dislike',
};
