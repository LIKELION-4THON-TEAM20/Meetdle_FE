import type { RoomState, SelectMeetingRequest } from '../../api/types';
import type {
  CandidateConfirmationRequest,
  CandidateData,
} from '../../pages/TimeRegionCandidates/types';

export function seoulDateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Invalid server meeting time');
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)!.value;
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}`,
  };
}

export function planningCandidates(state: RoomState): CandidateData {
  if (!state.options) return { timeCandidates: [], regionCandidates: [] };
  const names = new Map(state.members?.map((m) => [m.participantId, m.nickname]));
  return {
    // A11 already ranks slots. Preserve that order; the first slot is the recommendation.
    timeCandidates: state.options.slots.map((slot, index) => {
      const start = seoulDateTime(slot.meetingAt);
      const end = seoulDateTime(slot.endsAt);
      return {
        id: slot.slotId,
        date: start.date,
        startTime: start.time,
        endTime: end.date === start.date ? end.time : `${end.date} ${end.time}`,
        availableCount: slot.availableCount,
        totalCount: slot.availableCount + slot.unavailableParticipantIds.length,
        allParticipantsAvailable: slot.unavailableParticipantIds.length === 0,
        recommended: index === 0,
        unavailableParticipantNames: slot.unavailableParticipantIds.map(
          (id) => names.get(id) ?? '참여자',
        ),
      };
    }),
    regionCandidates: state.options.regions.map((region) => ({
      id: region.candidateId,
      stationName: region.station.name,
      subwayLines: region.station.lines,
      lineLabel: region.station.lines
        .map((line) => (/^\d+$/.test(line) ? `${line}호선` : line))
        .join('·'),
      recommended: region.reasons.includes('BALANCED'),
      recommendationLabel: region.reasons
        .map((reason) => (reason === 'BALANCED' ? '이동시간 균형이 좋아요' : '환승 부담이 적어요'))
        .join(' · '),
      averageTravelMinutes: region.meanMinutes,
      maximumTravelMinutes: region.maxMinutes,
      averageTransfers: region.meanTransfers,
      participantTravels: region.travel.map((travel) => ({
        ...travel,
        name: names.get(travel.participantId) ?? '참여자',
      })),
    })),
  };
}

export function meetingSelection(
  state: RoomState,
  request: CandidateConfirmationRequest,
): SelectMeetingRequest {
  const options = state.options;
  if (state.me.role !== 'HOST' || !state.allowedActions.includes('SELECT_MEETING')) {
    throw new Error('현재 상태에서는 약속을 확정할 수 없어요.');
  }
  if (
    !options?.slots.some((slot) => slot.slotId === request.timeCandidateId) ||
    !options.regions.some((region) => region.candidateId === request.regionCandidateId)
  ) {
    throw new Error('현재 방의 후보를 다시 선택해주세요.');
  }
  return {
    optionsId: options.optionsId,
    slotId: request.timeCandidateId,
    candidateId: request.regionCandidateId,
    expectedSelectionId: state.meeting?.selectionId ?? null,
  };
}
