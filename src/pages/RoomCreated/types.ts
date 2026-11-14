export interface MeetingInfo {
  name: string;
  candidateDates: string;
  capacity: number;
  participantCount: number;
}

export interface CreatedRoom {
  meeting: MeetingInfo;
  inviteCode: string;
}
