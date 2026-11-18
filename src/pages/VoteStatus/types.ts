export interface VoteParticipant {
  id: string;
  name: string;
  profileImageUrl?: string;
  completed: boolean;
}

export type VoteStatusPhase = 'ongoing' | 'allCompleted' | 'counting' | 'insufficient';
