import { useEffect, useState } from 'react';
import { api, ApiRequestError } from '../../../api/client';
import { getSession } from '../../../api/auth';
import { getRoomState } from '../../../api/rooms';
import type { RoomState, SessionResponse } from '../../../api/types';
import { assertScheduleState } from './model';

export function useScheduleRoom(roomId: string) {
  const [attempt, setAttempt] = useState(0);
  const key = `${roomId}:${attempt}`;
  const [result, setResult] = useState<{
    key: string;
    data?: { room: RoomState; session: SessionResponse };
    error?: unknown;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let observedSession: SessionResponse | undefined;
    let stage: 'session' | 'room' = 'session';
    const timeout = window.setTimeout(() => {
      if (controller.signal.aborted) return;
      setResult({
        key,
        error: new ApiRequestError(null, {
          code: stage === 'session' ? 'SESSION_TIMEOUT' : 'ROOM_TIMEOUT',
          message: 'Schedule loading timed out',
        }),
      });
      controller.abort();
    }, 15_000);
    const unsubscribe = api.subscribeSession((session) => {
      if (
        !observedSession ||
        (session &&
          session.user.userId === observedSession.user.userId &&
          session.csrfToken === observedSession.csrfToken)
      )
        return;
      observedSession = undefined;
      controller.abort();
      setResult({
        key,
        error: new ApiRequestError(null, {
          code: 'SESSION_CHANGED',
          message: 'Session changed',
        }),
      });
    });
    const refresh = () => {
      if (!document.hidden) void getSession({ refresh: true }).catch(() => {});
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    void (async () => {
      try {
        // Parent room entry has already checked the session. Avoid another forced
        // session refresh while switching from recruitment to schedule input.
        const session = await getSession();
        controller.signal.throwIfAborted();
        observedSession = session;
        stage = 'room';
        const room = await getRoomState(roomId, controller.signal);
        controller.signal.throwIfAborted();
        assertScheduleState(room, roomId);
        setResult({ key, data: { room, session } });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ key, error });
      } finally {
        window.clearTimeout(timeout);
      }
    })();
    return () => {
      window.clearTimeout(timeout);
      unsubscribe();
      controller.abort();
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [roomId, key]);
  return {
    result: result?.key === key ? result : null,
    reload: () => setAttempt((value) => value + 1),
  };
}
