import { ApiRequestError } from '../../api/client';
import type { Preference, RoomState } from '../../api/types';
import { flowDeadline, flowErrors } from './registrationFlow';

export const categoryLabels = { FOOD: '식당', CAFE: '카페', CULTURE: '문화시설', BAR: '주점' };
export const wireChoices = { dislike: 'DISLIKE', neutral: 'NEUTRAL', like: 'LIKE' } as const;
export const cardChoices = { DISLIKE: 'dislike', NEUTRAL: 'neutral', LIKE: 'like' } as const;

export function hasSubmittedVote(room: RoomState) {
  const completion = room.voteReview?.completion ?? room.voting?.completion;
  return Boolean(
    room.voting?.myDraft?.submitted ||
    completion?.some(
      ({ participantId, completed }) => participantId === room.me.participantId && completed,
    ),
  );
}

export function ballotPermissions(room: RoomState, now: number) {
  const open =
    room.phase === 'VOTING_OPEN' &&
    !!room.voting &&
    now < Date.parse(room.voting.closesAt) &&
    room.me.canVote &&
    !hasSubmittedVote(room);
  return {
    edit: open && room.allowedActions.includes('EDIT_PREFERENCES'),
    submit: open && room.allowedActions.includes('SUBMIT_VOTE'),
  };
}

export function ballotSelections(room: RoomState, saved: Preference[], changes: Preference[]) {
  const choices = new Map(
    [...saved, ...changes].map(({ candidateId, choice }) => [candidateId, choice]),
  );
  const targets = room.voting?.candidates.filter(({ mode }) => mode === 'VOTE') ?? [];
  const selections = targets.flatMap(({ candidateId }) => {
    const choice = choices.get(candidateId);
    return choice && Object.hasOwn(cardChoices, choice) ? [{ candidateId, choice }] : [];
  });
  return { selections, total: targets.length, complete: targets.length === selections.length };
}

export function voteExtensionRange(room: RoomState, now: number) {
  const start = flowDeadline(room, 'VOTE', now);
  return {
    minimum: Math.max(now, Date.parse(room.voting?.closesAt ?? '') || 0) + 1,
    maximum: start.maximum,
  };
}

export function voteDecisionPermissions(room: RoomState) {
  const review = room.voteReview;
  const hostReview = room.phase === 'VOTE_REVIEW_REQUIRED' && room.me.role === 'HOST';
  return {
    extend: hostReview && !!review?.canExtend && room.allowedActions.includes('EXTEND_VOTE'),
    proceed:
      hostReview &&
      !!review?.canProceed &&
      review.progress.completedCount > 0 &&
      room.allowedActions.includes('PROCEED_WITH_VOTES'),
  };
}

const voteErrors: Record<string, string> = {
  ...flowErrors,
  INVALID_REQUEST: '투표 요청을 확인하고 다시 시도해주세요.',
  INVALID_CANDIDATE: '선택한 후보가 바뀌었어요. 후보를 다시 확인해주세요.',
  DUPLICATE_CANDIDATE: '후보마다 한 가지 선호도를 선택해주세요.',
  ALREADY_SUBMITTED: '이미 투표를 제출했어요.',
  STALE_DRAFT: '서버 초안이 바뀌었어요. 선택을 확인한 뒤 다시 저장해주세요.',
  STALE_ROUND: '투표 회차가 바뀌었어요. 최신 회차를 확인해주세요.',
  DEADLINE_PASSED: '투표 마감 시간이 지났어요.',
  VOTE_INCOMPLETE: '아직 선택하지 않은 후보가 있어요.',
  NO_SUBMITTED_VOTES: '제출된 투표가 없어 결과를 진행할 수 없어요.',
};

export function voteError(error: unknown) {
  return error instanceof ApiRequestError
    ? (voteErrors[error.code] ?? '투표 요청을 처리하지 못했어요.')
    : '현재 투표 상태를 다시 확인해주세요.';
}
