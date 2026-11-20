import { useEffect, useState } from 'react';
import { getSession } from '../../api/auth';
import { getRoomState } from '../../api/rooms';
import type { RoomState } from '../../api/types';

export function usePlanningRoom(roomId: string) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ attempt: number; state?: RoomState; error?: unknown }>();
  useEffect(() => {
    const abort = new AbortController();
    void (async () => {
      try {
        await getSession({ refresh: true });
        if (abort.signal.aborted) return;
        const state = await getRoomState(roomId, abort.signal);
        if (!abort.signal.aborted) setResult({ attempt, state });
      } catch (error) {
        if (!abort.signal.aborted) setResult({ attempt, error });
      }
    })();
    return () => abort.abort();
  }, [roomId, attempt]);
  return {
    state: result?.attempt === attempt ? result.state : undefined,
    error: result?.attempt === attempt ? result.error : undefined,
    reload: () => setAttempt((value) => value + 1),
  };
}
