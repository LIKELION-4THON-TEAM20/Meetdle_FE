import { useEffect, useState } from 'react';
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
    void (async () => {
      try {
        const session = await getSession({ refresh: true });
        controller.signal.throwIfAborted();
        const room = await getRoomState(roomId, controller.signal);
        controller.signal.throwIfAborted();
        assertScheduleState(room, roomId);
        setResult({ key, data: { room, session } });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ key, error });
      }
    })();
    return () => controller.abort();
  }, [roomId, key]);
  return {
    result: result?.key === key ? result : null,
    reload: () => setAttempt((value) => value + 1),
  };
}
