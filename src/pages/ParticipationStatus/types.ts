export type ParticipantStatus = 'completed' | 'inProgress' | 'notStarted';

export interface Participant {
  id: string;
  name: string;
  profileImageUrl?: string;
  status: ParticipantStatus;
  role?: 'HOST' | 'MEMBER';
}
