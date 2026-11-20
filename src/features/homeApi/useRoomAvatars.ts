import { useEffect, useState } from 'react';
import { getRoomState } from '../../api/rooms';
import type { MyRoomSummary } from '../../api/types';
import type { Participant } from '../../pages/Home/appointment.types';
import { roomParticipants } from './model';

export function useRoomAvatars(rooms: readonly MyRoomSummary[], scope: string) {
  const [snapshot, setSnapshot] = useState<{
    scope: string;
    members: Record<string, Participant[]>;
  }>({ scope, members: {} });
  useEffect(() => {
    if (!rooms.length) return;
    const controller = new AbortController();
    let index = 0;
    // The summary endpoint has no member photos. Bound concurrent A08 reads.
    const worker = async () => {
      while (index < rooms.length && !controller.signal.aborted) {
        const roomId = rooms[index++].roomId;
        try {
          const room = await getRoomState(roomId, controller.signal);
          if (controller.signal.aborted) return;
          const participants = roomParticipants(room, roomId);
          setSnapshot((previous) => ({
            scope,
            members: {
              ...(previous.scope === scope ? previous.members : {}),
              [roomId]: participants,
            },
          }));
        } catch {
          // A failed avatar read must not hide a successfully loaded room card.
        }
      }
    };
    void Promise.all(Array.from({ length: Math.min(4, rooms.length) }, worker));
    return () => controller.abort();
  }, [rooms, scope]);
  return snapshot.scope === scope ? snapshot.members : {};
}
