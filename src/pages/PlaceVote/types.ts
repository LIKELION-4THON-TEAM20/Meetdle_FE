export type VoteChoice = 'dislike' | 'neutral' | 'like';
export type VoteResponses = Record<string, VoteChoice>;

export interface VotePlace {
  id: string;
  name: string;
  distanceMeters: number;
  address: string;
  kakaoMapUrl?: string;
}

export interface VoteCategory {
  id: string;
  name: string;
  places: VotePlace[];
}

export interface VoteState {
  responses: VoteResponses;
  submitted: boolean;
}
