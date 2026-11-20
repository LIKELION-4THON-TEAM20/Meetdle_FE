import { ApiRequestError } from '../../../api/client';
import { getSession } from '../../../api/auth';
import { getRoomState, roomMutations } from '../../../api/rooms';
import type { MyInput, RoomState, SaveMyInputRequest, SessionResponse } from '../../../api/types';
import type { ScheduleTransitInput } from '../types';
import {
  assertScheduleState,
  candidateDates,
  invalidScheduleResponse,
  matchesSavedInput,
  restoreScheduleInput,
  toSaveInput,
} from './model';

interface SaveDependencies {
  getSession: () => Promise<SessionResponse>;
  getState: (id: string) => Promise<RoomState>;
  save: (id: string, body: SaveMyInputRequest) => { execute: () => Promise<MyInput> };
}
export class ScheduleConflictError extends Error {
  readonly snapshot: RoomState;
  constructor(snapshot: RoomState) {
    super('STALE_INPUT');
    this.snapshot = snapshot;
  }
}
export function createScheduleSaver(
  initial: RoomState,
  owner: SessionResponse,
  deps: SaveDependencies = { getSession, getState: getRoomState, save: roomMutations.saveInput },
) {
  let pending: Promise<RoomState> | undefined;
  let operation: ReturnType<SaveDependencies['save']> | undefined;
  let body: SaveMyInputRequest | undefined;
  let saved: MyInput | undefined;
  let uncertain = false;
  let conflict: RoomState | undefined;
  let conflictPending = false;
  const assertOwner = async () => {
    const current = await deps.getSession();
    if (current.user.userId !== owner.user.userId || current.csrfToken !== owner.csrfToken)
      throw new ApiRequestError(null, { code: 'SESSION_CHANGED', message: 'Session changed' });
  };
  const readState = async () => {
    const state = await deps.getState(initial.roomId);
    await assertOwner();
    assertScheduleState(state, initial.roomId);
    return state;
  };
  const confirmedState = (state: RoomState) => {
    if (
      !saved ||
      !body ||
      state.myInput.inputRevision <= body.inputRevision ||
      state.myInput.inputRevision < saved.inputRevision ||
      !state.myInput.completedAt ||
      !matchesSavedInput(state.myInput, body)
    )
      invalidScheduleResponse('Saved input is not reflected in RoomState');
    return state;
  };
  // The save receipt is authoritative, but state projection can lag briefly.
  // Retry only the read; never submit a second PUT for an accepted input.
  const waitForSavedState = async () => {
    for (let attempt = 0; ; attempt++) {
      const state = await readState();
      if (saved && body && state.myInput.completedAt &&
          state.myInput.inputRevision >= saved.inputRevision &&
          matchesSavedInput(state.myInput, body)) return confirmedState(state);
      if (attempt >= 3 || !body || state.myInput.inputRevision > (saved?.inputRevision ?? body.inputRevision))
        return confirmedState(state);
      await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
    }
  };
  const run = (input: ScheduleTransitInput): Promise<RoomState> => {
    if (pending) return pending;
    pending = (async () => {
      await assertOwner();
      if (conflict) throw new ScheduleConflictError(conflict);
      if (conflictPending) {
        conflict = await readState();
        throw new ScheduleConflictError(conflict);
      }
      if (saved) return waitForSavedState();
      if (uncertain && body) {
        const current = await readState();
        if (
          current.myInput.inputRevision > body.inputRevision &&
          current.myInput.completedAt &&
          matchesSavedInput(current.myInput, body)
        ) {
          saved = current.myInput;
          uncertain = false;
          return current;
        }
        if (
          current.myInput.inputRevision !== initial.myInput.inputRevision ||
          current.myInput.completedAt ||
          !current.allowedActions.includes('COMPLETE_INPUT')
        ) {
          conflict = current;
          throw new ScheduleConflictError(current);
        }
        uncertain = false;
      }
      const nextBody = toSaveInput(initial, input);
      if (!body || JSON.stringify(body) !== JSON.stringify(nextBody)) {
        body = nextBody;
        operation = deps.save(initial.roomId, body);
      }
      let response: MyInput;
      try {
        response = await operation!.execute();
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 409) {
          conflictPending = true;
          // 버전 충돌에서는 새 버전으로 자동 재제출하지 않는다.
          conflict = await readState();
          throw new ScheduleConflictError(conflict);
        }
        uncertain =
          !(error instanceof ApiRequestError) || error.status === null || error.status >= 500;
        throw error;
      }
      await assertOwner();
      saved = response; // PUT 성공 후 재조회 실패는 GET만 재시도한다.
      restoreScheduleInput(candidateDates(initial.dates), response);
      if (
        response.inputRevision <= body.inputRevision ||
        !response.completedAt ||
        !matchesSavedInput(response, body)
      )
        invalidScheduleResponse('Incomplete save response');
      return waitForSavedState();
    })().finally(() => {
      pending = undefined;
    });
    return pending;
  };
  return {
    run,
    get freeze() {
      return uncertain || !!saved || !!conflict || conflictPending;
    },
  };
}
