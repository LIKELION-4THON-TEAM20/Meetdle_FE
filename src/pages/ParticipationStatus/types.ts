export type ParticipantStatus = 'completed' | 'inProgress' | 'notStarted';

export interface Participant {
  id: string;
  name: string;
  status: ParticipantStatus;
}
