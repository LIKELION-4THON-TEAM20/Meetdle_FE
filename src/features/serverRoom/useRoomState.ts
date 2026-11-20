import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { createRoomStateStore, estimateServerNow } from './roomState';
import { roomPollingInterval, shouldPollRoom } from './routing';
import type { RoomState } from '../../api/types';

export function useRoomState(
  roomId: string,
  poll: boolean | ((room: RoomState) => boolean) = false,
) {
  const store = useMemo(() => createRoomStateStore(roomId), [roomId]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const polling =
    poll &&
    !snapshot.error &&
    snapshot.room !== null &&
    (typeof poll === 'function' ? poll(snapshot.room) : shouldPollRoom(snapshot.room));

  useEffect(() => {
    const disconnect = store.connect();
    const refresh = () => {
      if (!document.hidden) void store.refresh({ checkSession: false });
    };
    void store.refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      disconnect();
    };
  }, [store]);

  const pollInterval = snapshot.room ? roomPollingInterval(snapshot.room) : 15_000;
  useEffect(() => {
    if (!polling) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) void store.refresh({ checkSession: false });
    }, pollInterval);
    return () => window.clearInterval(timer);
  }, [polling, pollInterval, store]);

  return {
    ...snapshot,
    refresh: store.refresh,
    mutate: store.mutate,
    can: (action: Parameters<typeof store.mutate>[0]) =>
      !snapshot.error && Boolean(snapshot.room?.allowedActions.includes(action)),
    serverNow: snapshot.room ? estimateServerNow(snapshot.room, snapshot.receivedAt) : null,
  };
}
