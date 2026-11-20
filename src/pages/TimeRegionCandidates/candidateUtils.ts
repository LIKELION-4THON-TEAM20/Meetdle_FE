import type { CandidateConfirmationRequest, CandidateData, CandidateSelection } from './types';

export function formatCandidateDate(date: string, shortWeekday = false): string {
  const parts = new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    weekday: shortWeekday ? 'short' : 'long',
    timeZone: 'Asia/Seoul',
  }).formatToParts(new Date(`${date}T12:00:00+09:00`));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return `${value('month')}월 ${value('day')}일 ${shortWeekday ? `(${value('weekday')})` : value('weekday')}`;
}

export function reconcileSelection(
  data: CandidateData,
  selection: CandidateSelection,
): CandidateSelection {
  const timeCandidateId = data.timeCandidates.some(({ id }) => id === selection.timeCandidateId)
    ? selection.timeCandidateId
    : null;
  const regionCandidateId = data.regionCandidates.some(
    ({ id }) => id === selection.regionCandidateId,
  )
    ? selection.regionCandidateId
    : null;
  if (
    timeCandidateId === selection.timeCandidateId &&
    regionCandidateId === selection.regionCandidateId
  ) {
    return selection;
  }
  return { timeCandidateId, regionCandidateId };
}

export function getConfirmationRequest(
  data: CandidateData,
  selection: CandidateSelection,
): CandidateConfirmationRequest | null {
  const valid = reconcileSelection(data, selection);
  return valid.timeCandidateId && valid.regionCandidateId
    ? { timeCandidateId: valid.timeCandidateId, regionCandidateId: valid.regionCandidateId }
    : null;
}
