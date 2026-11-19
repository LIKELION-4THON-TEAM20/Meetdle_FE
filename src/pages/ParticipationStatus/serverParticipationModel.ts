import { ApiRequestError } from '../../api/client';
import { roomMutations } from '../../api/rooms';
import type { RoomState } from '../../api/types';
import type { Participant } from './types';

export function participationModel(room: RoomState) {
  const participants: Participant[] = (room.members ?? []).map((member) => ({
    id: member.participantId,
    name: member.nickname,
    role: member.role,
    profileImageUrl: member.profileImageUrl ?? undefined,
    status:
      member.inputComplete || member.inputStatus === 'COMPLETED'
        ? 'completed'
        : member.inputStatus === 'IN_PROGRESS'
          ? 'inProgress'
          : 'notStarted',
  }));
  const host = room.me.role === 'HOST';
  const waiting = room.phase === 'WAITING_FOR_DEPARTURE';
  const completed = room.inputProgress.completedCount;
  const incomplete = participants.filter((member) => member.status !== 'completed');
  return {
    participants,
    host,
    completed,
    incomplete,
    canStart:
      waiting && host && room.joinedCount >= 2 && room.allowedActions.includes('START_ROOM'),
    canCalculate:
      waiting && host && completed >= 2 && room.allowedActions.includes('CALCULATE_OPTIONS'),
    canRemind: waiting && incomplete.some((member) => member.id !== room.me.participantId),
    canNotifyHost: waiting && !host && completed >= 2,
  };
}

export function createParticipationCommands() {
  let planning:
    | { roomId: string; version: number; handle: ReturnType<typeof roomMutations.calculateOptions> }
    | undefined;
  return {
    start(room: RoomState) {
      if (!participationModel(room).canStart) throw new Error('Room cannot start');
      return roomMutations.start(room.roomId, { expectedRevision: room.revision }).execute();
    },
    async calculate(room: RoomState) {
      if (!participationModel(room).canCalculate) throw new Error('Planning is unavailable');
      if (planning?.roomId !== room.roomId || planning.version !== room.inputVersion) {
        planning = {
          roomId: room.roomId,
          version: room.inputVersion,
          handle: roomMutations.calculateOptions(room.roomId, { inputVersion: room.inputVersion }),
        };
      }
      try {
        return await planning.handle.execute();
      } catch (error) {
        if (
          error instanceof ApiRequestError &&
          ['SESSION_CHANGED', 'KEY_REUSED'].includes(error.code)
        )
          planning = undefined;
        throw error;
      }
    },
  };
}

const errors: Record<string, string> = {
  NOT_ENOUGH_MEMBERS: '두 명 이상 참여하면 모임을 시작할 수 있어요.',
  NOT_ENOUGH_INPUTS: '두 명 이상 입력을 완료해야 후보를 계산할 수 있어요.',
  NO_FEASIBLE_OPTION: '함께 가능한 시간이나 만날 지역을 찾지 못했어요.',
  MATRIX_UNAVAILABLE: '이동 시간 정보를 잠시 사용할 수 없어요. 다시 시도해주세요.',
  STALE_ROOM: '최신 참여 인원을 다시 확인해주세요.',
  STALE_INPUT: '입력 현황이 바뀌었어요. 최신 정보로 다시 진행해주세요.',
  WRONG_PHASE: '현재 단계에서는 이 요청을 진행할 수 없어요.',
  UNAUTHENTICATED: '로그인 세션이 만료됐어요.',
  FORBIDDEN: '이 요청을 실행할 권한이 없어요.',
  NOT_FOUND: '약속방을 찾을 수 없어요.',
  NETWORK_ERROR: '연결이 끊겼어요. 잠시 후 다시 시도해주세요.',
};

export function participationError(error: unknown) {
  return error instanceof ApiRequestError
    ? (errors[error.code] ?? '요청을 완료하지 못했어요. 다시 시도해주세요.')
    : '요청을 완료하지 못했어요. 다시 시도해주세요.';
}
