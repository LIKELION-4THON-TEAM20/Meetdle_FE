import type { VotePlace } from '../PlaceVote/types';

export type ResultRole = 'host' | 'participant';
export interface VoteCounts {
  like: number;
  neutral: number;
  dislike: number;
}
export interface ResultPlace extends VotePlace {
  votes: VoteCounts;
  tieVotes?: number;
}
export interface ResultCategory {
  id: string;
  name: string;
  place: ResultPlace;
}
export interface ResultState {
  categories: ResultCategory[];
  order: string[];
  unresolvedTie: boolean;
  revotesUsed: number;
}
