export interface VoteParticipant {
  id: string;
  name: string;
  completed: boolean;
}

export type VoteStatusPhase = 'ongoing' | 'allCompleted' | 'counting' | 'insufficient';
