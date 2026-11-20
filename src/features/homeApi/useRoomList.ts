import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiRequestError } from '../../api/client';
import { getMyRooms } from '../../api/rooms';
import type { MyRoomSummary } from '../../api/types';
import { toAppointment } from './model';

export function useRoomList(scope: 'ALL' | 'UPCOMING' | 'PAST', revision: number) {
  const [attempt, setAttempt] = useState(0);
  const key = `${scope}:${revision}:${attempt}`;
  const [state, setState] = useState<{
    key: string;
    items: MyRoomSummary[];
    nextCursor: string | null;
    loading: boolean;
    error: unknown;
  }>({ key, items: [], nextCursor: null, loading: true, error: null });
  const active = useRef<{ key: string; controller: AbortController; pending: boolean } | null>(
    null,
  );
  const read = useCallback(
    async (request: NonNullable<typeof active.current>, cursor?: string) => {
      try {
        const page = await getMyRooms(
          { scope, limit: 20, ...(cursor ? { cursor } : {}) },
          request.controller.signal,
        );
        if (
          !Array.isArray(page?.items) ||
          !(page.nextCursor === null || typeof page.nextCursor === 'string') ||
          (cursor && page.nextCursor === cursor)
        )
          throw new ApiRequestError(200, {
            code: 'INVALID_RESPONSE',
            message: 'Invalid room page.',
          });
        page.items.forEach(toAppointment);
        if (active.current !== request || request.controller.signal.aborted) return;
        setState((previous) => ({
          key: request.key,
          items: cursor
            ? [
                ...new Map(
                  [...previous.items, ...page.items].map((room) => [room.roomId, room]),
                ).values(),
              ]
            : page.items,
          nextCursor: page.nextCursor,
          loading: false,
          error: null,
        }));
      } catch (error) {
        if (active.current === request && !request.controller.signal.aborted)
          setState((previous) => ({ ...previous, loading: false, error }));
      } finally {
        request.pending = false;
      }
    },
    [scope],
  );
  useEffect(() => {
    const request = { key, controller: new AbortController(), pending: true };
    active.current = request;
    setState({ key, items: [], nextCursor: null, loading: true, error: null });
    void read(request);
    return () => {
      request.controller.abort();
    };
  }, [key, read]);
  const current =
    state.key === key ? state : { key, items: [], nextCursor: null, loading: true, error: null };
  return {
    ...current,
    retry: () => setAttempt((value) => value + 1),
    loadMore: () => {
      const request = active.current;
      if (!request || request.key !== key || request.pending || !current.nextCursor) return;
      request.pending = true;
      setState((previous) => ({ ...previous, loading: true, error: null }));
      void read(request, current.nextCursor);
    },
  };
}
