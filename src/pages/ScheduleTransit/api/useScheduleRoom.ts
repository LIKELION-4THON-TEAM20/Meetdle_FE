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
    let sessionObserved = false;
    const unsubscribe = api.subscribeSession(() => {
      if (!sessionObserved) return;
      sessionObserved = false;
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
        const session = await getSession({ refresh: true });
        controller.signal.throwIfAborted();
        sessionObserved = true;
        const room = await getRoomState(roomId, controller.signal);
        controller.signal.throwIfAborted();
        assertScheduleState(room, roomId);
        setResult({ key, data: { room, session } });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ key, error });
      }
    })();
    return () => {
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
