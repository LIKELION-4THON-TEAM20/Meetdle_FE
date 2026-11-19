import { ApiRequestError } from '../../api/client';
import type { Category, RoomState } from '../../api/types';
import { flowErrors } from './registrationFlow';
import { registrationWindow } from '../../pages/PlaceRegistrationSetup/serverSetupModel';

export function validVisitOrder(room: RoomState, ids: string[]) {
  const selected = room.result?.selected ?? [];
  return (
    ids.length > 0 &&
    ids.length === selected.length &&
    new Set(ids).size === ids.length &&
    selected.every(({ candidateId }) => ids.includes(candidateId)) &&
    new Set(selected.map(({ candidateId }) => candidateId)).size === selected.length
  );
}

export function tieChoices(room: RoomState, selections: Partial<Record<Category, string>>) {
  const groups = room.tieDecision?.groups ?? [];
  const choices = groups.flatMap(({ category, places }) => {
    const candidateId = selections[category];
    return candidateId && places.some((place) => place.candidateId === candidateId)
      ? [{ category, candidateId }]
      : [];
  });
  return groups.length &&
    choices.length === groups.length &&
    new Set(choices.map(({ category }) => category)).size === groups.length &&
    new Set(choices.map(({ candidateId }) => candidateId)).size === groups.length
    ? choices
    : null;
}

export function resultPermissions(room: RoomState, now: number) {
  const host = room.me.role === 'HOST';
  const finalized =
    room.phase === 'FINAL_PLACE_CONFIRMED' && !!room.result && room.result.confirmed !== false;
  const ready = room.phase === 'RESULT_READY' && room.result?.confirmed !== true;
  const tie = room.phase === 'WAITING_FOR_HOST_DECISION';
  const started = !(
    now < Date.parse(room.result?.meeting.meetingAt ?? room.meeting?.meetingAt ?? '')
  );
  const validOrder = !!room.result && validVisitOrder(room, room.result.visitOrder);
  const unresolved = !!room.tieDecision?.groups.length;
  const can = (action: RoomState['allowedActions'][number]) =>
    host && room.allowedActions.includes(action);
  return {
    finalized,
    tie: tie && !started && unresolved && can('RESOLVE_TIES'),
    order: validOrder && (((ready || tie) && !started) || finalized) && can('REORDER_VISIT'),
    confirm: ready && !started && !unresolved && validOrder && can('CONFIRM_RESULT'),
    recover:
      room.phase === 'RECOVERY_REQUIRED' &&
      room.recovery?.reason === 'NO_ELIGIBLE_RESULT' &&
      can('RECOLLECT') &&
      registrationWindow(room, now).canOpen,
  };
}

const errors: Record<string, string> = {
  ...flowErrors,
  STALE_RESULT: '결과가 바뀌었어요. 최신 결과를 확인해주세요.',
  STALE_ROUND: '회차가 바뀌었어요. 최신 결과를 확인해주세요.',
  INVALID_REQUEST: '요청 내용을 확인해주세요.',
  INVALID_TIE_CHOICE: '동률 카테고리마다 서버가 제공한 후보 한 곳을 선택해주세요.',
  INVALID_VISIT_ORDER: '선정된 장소를 한 번씩 포함해 순서를 저장해주세요.',
  DEADLINE_PASSED: '변경할 수 있는 시간이 지났어요.',
  RETRY_EXHAUSTED: '장소 재등록 기회를 이미 사용했어요.',
};

export function resultError(error: unknown) {
  return error instanceof ApiRequestError
    ? (errors[error.code] ?? '결과 요청을 처리하지 못했어요.')
    : '최신 결과를 확인한 뒤 다시 시도해주세요.';
}
