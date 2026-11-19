import { api, ApiRequestError } from '../../api/client';
import { getRoomState } from '../../api/rooms';
import type { Action, RoomState } from '../../api/types';

interface Snapshot {
  room: RoomState | null;
  error: unknown;
  loading: boolean;
  notice: string | null;
  receivedAt: number;
}

const initial: Snapshot = { room: null, error: null, loading: true, notice: null, receivedAt: 0 };

export function createRoomStateStore(roomId: string, read = getRoomState, client = api) {
  let snapshot = initial;
  let current: AbortController | undefined;
  let pending: Promise<void> | undefined;
  let mutation: { action: Action; task: Promise<unknown> } | undefined;
  let scope = 0;
  const listeners = new Set<() => void>();

  function publish(next: Snapshot) {
    snapshot = next;
    listeners.forEach((listener) => listener());
  }

  function cancel() {
    current?.abort();
    pending = undefined;
    current = undefined;
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function connect() {
    const unsubscribe = client.subscribeSession((authenticated) => {
      scope++;
      mutation = undefined;
      cancel();
      publish({
        ...initial,
        loading: authenticated,
        error: authenticated
          ? null
          : new ApiRequestError(401, {
              code: 'UNAUTHENTICATED',
              message: 'Authentication required',
            }),
      });
      if (authenticated) void refresh({ checkSession: false });
    });
    return () => {
      unsubscribe();
      cancel();
      scope++;
      mutation = undefined;
      snapshot = initial;
    };
  }

  function refresh({ checkSession = true, replace = false } = {}) {
    if (pending && !replace) return pending;
    cancel();
    const controller = new AbortController();
    current = controller;
    publish({ ...snapshot, error: null, loading: true });
    const task = Promise.resolve().then(async () => {
      try {
        if (checkSession) await client.getSession({ refresh: true });
        if (controller.signal.aborted) return;
        const room = await read(roomId, controller.signal);
        if (controller.signal.aborted) return;
        const previous = snapshot.room;
        if (previous && previous.revision > room.revision) return;
        publish({ ...snapshot, room, error: null, loading: false, receivedAt: Date.now() });
      } catch (error) {
        if (controller.signal.aborted) return;
        const inaccessible =
          error instanceof ApiRequestError && [401, 403, 404].includes(error.status ?? 0);
        publish({ ...snapshot, room: inaccessible ? null : snapshot.room, error, loading: false });
      } finally {
        if (current === controller) {
          current = undefined;
          pending = undefined;
          if (snapshot.loading) publish({ ...snapshot, loading: false });
        }
      }
    });
    pending = task;
    return task;
  }

  function mutate<T>(
    action: Action,
    execute: (room: RoomState, receivedAt: number) => Promise<T>,
  ): Promise<T> {
    if (mutation) {
      if (mutation.action === action) return mutation.task as Promise<T>;
      return Promise.reject(new Error('A room action is already running.'));
    }
    const { room, error, receivedAt } = snapshot;
    if (!room?.allowedActions.includes(action) || error) {
      return Promise.reject(new Error('This room action is unavailable.'));
    }
    const start = scope;
    publish({ ...snapshot, notice: null });
    const task = Promise.resolve()
      .then(async () => {
        try {
          if (scope !== start) throw new Error('The room session changed.');
          const value = await execute(room, receivedAt);
          if (scope === start) await refresh({ replace: true });
          return value;
        } catch (error) {
          if (scope === start && error instanceof ApiRequestError && error.status === 409) {
            publish({
              ...snapshot,
              notice: '약속방 상태가 바뀌었어요. 최신 정보를 다시 확인해주세요.',
            });
            await refresh({ replace: true });
          }
          throw error;
        }
      })
      .finally(() => {
        if (mutation?.task === task) mutation = undefined;
      });
    mutation = { action, task };
    return task;
  }

  return { subscribe, connect, refresh, mutate, getSnapshot: () => snapshot };
}

export function estimateServerNow(room: RoomState, receivedAt: number, now = Date.now()) {
  return Date.parse(room.serverNow) + Math.max(0, now - receivedAt);
}
