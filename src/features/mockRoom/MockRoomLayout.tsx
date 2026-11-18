import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { MockRoomContext } from './context';
import { createRoomDispatcher } from './dispatcher';
import { createMockRoom, isMockRoom, restoreRoom, saveRoom, type MockRoom } from './model';
import { MOCK_ROOM_ID, PATHS, roomPath } from '../../router/paths';
import { CREATED_ROOM_PREVIEW_ID } from '../createdRoom/model';
import { RoomRecovery } from '../../router/FlowLayout';

function Provider({
  children,
  isolated,
  role,
  reset,
  roomId,
  fallbackRoom,
}: {
  children: ReactNode;
  isolated: boolean;
  role: string | null;
  reset: boolean;
  roomId: string;
  fallbackRoom: unknown;
}) {
  const { pathname, search } = useLocation();
  const hostOnlyRegistration = pathname === PATHS.closeRegistration || pathname === PATHS.startVote;
  const [room, setRoom] = useState<MockRoom>(() => {
    const initial = (() => {
      try {
        if (!isolated && !reset && isMockRoom(fallbackRoom, roomId)) return fallbackRoom;
        return isolated || reset
          ? createMockRoom(Date.now(), roomId)
          : restoreRoom(window.sessionStorage, Date.now(), roomId);
      } catch {
        return createMockRoom(Date.now(), roomId);
      }
    })();
    return role === 'host' || role === 'participant'
      ? { ...initial, role, currentUserId: role === 'host' ? 'sangmin' : 'haneul' }
      : initial;
  });
  const [send] = useState(() =>
    createRoomDispatcher(room, (next) => {
      setRoom(next);
      if (!isolated) {
        try {
          saveRoom(window.sessionStorage, next);
        } catch {
          /* In-memory fallback. */
        }
      }
    }),
  );
  useEffect(() => {
    if (!isolated) {
      try {
        saveRoom(window.sessionStorage, room);
      } catch {
        /* In-memory fallback. */
      }
    }
  }, [isolated, room]);
  useEffect(() => {
    if (isolated) return;
    const refresh = () => send({ type: 'tick', now: Date.now() });
    const timer = globalThis.setInterval(refresh, 1000);
    globalThis.addEventListener('focus', refresh);
    return () => {
      globalThis.clearInterval(timer);
      globalThis.removeEventListener('focus', refresh);
    };
  }, [isolated, send]);
  return (
    <MockRoomContext.Provider value={{ room, send, isolated }}>
      {(pathname === PATHS.setup || hostOnlyRegistration) && room.role === 'participant' ? (
        <Navigate
          to={roomPath(hostOnlyRegistration ? PATHS.registration : PATHS.info, search)}
          replace
        />
      ) : (
        children
      )}
    </MockRoomContext.Provider>
  );
}

export default function MockRoomLayout() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const roomId = params.get('roomId') ?? MOCK_ROOM_ID;
  if (roomId !== MOCK_ROOM_ID && roomId !== CREATED_ROOM_PREVIEW_ID) {
    return (
      <RoomRecovery message="이 약속방의 확정·등록·투표 데이터가 이 브라우저에 없어요. 다른 방의 목 결과를 대신 표시하지 않습니다." />
    );
  }
  const scenario = import.meta.env.DEV ? params.get('scenario') : null;
  const clock = import.meta.env.DEV && params.get('clock') === 'fixed';
  const requestedRole = params.get('role');
  const role = import.meta.env.DEV || requestedRole === 'participant' ? requestedRole : null;
  const reset = import.meta.env.DEV && params.get('mock') === 'reset';
  const isolated = scenario !== null || clock;
  return (
    <Provider
      key={
        isolated
          ? `${roomId}:${location.pathname}:${scenario}:${clock}:${role}`
          : `${roomId}:${role}:${reset}`
      }
      isolated={isolated}
      role={role}
      reset={reset}
      roomId={roomId}
      fallbackRoom={location.state?.fallbackRoom}
    >
      <Outlet />
    </Provider>
  );
}
