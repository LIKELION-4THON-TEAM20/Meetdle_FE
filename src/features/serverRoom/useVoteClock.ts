import { useEffect, useRef, useState } from 'react';
import type { RoomState } from '../../api/types';
import { estimateServerNow } from './roomState';
import type { useRoomState } from './useRoomState';

export function useVoteClock(room: RoomState, state: ReturnType<typeof useRoomState>) {
  const [wallTime, setWallTime] = useState(Date.now);
  const expiry = useRef('');
  const now = estimateServerNow(room, state.receivedAt, wallTime);
  const deadline = Date.parse(room.voting?.closesAt ?? '');
  const expired = room.phase === 'VOTING_OPEN' && now >= deadline;
  const key = `${room.roomId}:${room.voting?.round}:${deadline}`;
  const { refresh } = state;

  useEffect(() => {
    const timer = window.setInterval(() => setWallTime(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!expired || expiry.current === key) return;
    expiry.current = key;
    void refresh();
  }, [expired, key, refresh]);

  return { now, deadline, expired };
}
