// SCREEN 05 전용 임시 모델. 백엔드 응답 계약 확정 시 어댑터에서 교체한다.
export interface TimeCandidate {
  id: string;
  date: string; // YYYY-MM-DD, 약속 지역의 날짜
  startTime: string;
  endTime: string;
  availableCount: number;
  totalCount: number;
  allParticipantsAvailable: boolean;
  recommended: boolean;
  averageWaitMinutes?: number;
  unavailableParticipantNames: readonly string[];
}

export interface ParticipantTravel {
  participantId: string;
  name: string;
  transportLabel: string;
  minutes: number;
  transfers: number;
}

export interface RegionCandidate {
  id: string;
  stationName: string;
  subwayLines: readonly string[];
  recommended: boolean;
  recommendationLabel: string;
  averageTravelMinutes: number;
  maximumTravelMinutes: number;
  averageTransfers: number;
  participantTravels: readonly ParticipantTravel[];
}

export interface CandidateData {
  timeCandidates: readonly TimeCandidate[];
  regionCandidates: readonly RegionCandidate[];
}

export interface CandidateSelection {
  timeCandidateId: string | null;
  regionCandidateId: string | null;
}

export interface CandidateConfirmationRequest {
  timeCandidateId: string;
  regionCandidateId: string;
}
