import { MOCK_CANDIDATE_DATA } from './mockData';
import type { CandidateData } from './types';

// API 연결 시 조회 및 응답 변환을 이 경계에서 교체한다.
// 시간별 지역 후보의 관계는 미정이며, 현재 fixture는 계산 없이 두 목록을 제공한다.
export function getTimeRegionCandidates(): CandidateData {
  return MOCK_CANDIDATE_DATA;
}
