import { useEffect, useState, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router';
import { MockRoomContext } from './context';
import { createRoomDispatcher } from './dispatcher';
import { createMockRoom, restoreRoom, STORAGE_KEY, type MockRoom } from './model';

function Provider({
  children,
  isolated,
  role,
  reset,
}: {
  children: ReactNode;
  isolated: boolean;
  role: string | null;
  reset: boolean;
}) {
  const [room, setRoom] = useState<MockRoom>(() => {
    const initial = (() => {
      try {
        return isolated || reset
          ? createMockRoom(Date.now())
          : restoreRoom(window.sessionStorage, Date.now());
      } catch {
        return createMockRoom(Date.now());
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
          window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* In-memory fallback. */
        }
      }
    }),
  );
  useEffect(() => {
    if (!isolated) {
      try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(room));
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
    <MockRoomContext.Provider value={{ room, send, isolated }}>{children}</MockRoomContext.Provider>
  );
}

export default function MockRoomLayout() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const scenario = import.meta.env.DEV ? params.get('scenario') : null;
  const clock = import.meta.env.DEV && params.get('clock') === 'fixed';
  const role = import.meta.env.DEV ? params.get('role') : null;
  const reset = import.meta.env.DEV && params.get('mock') === 'reset';
  const isolated = scenario !== null || clock;
  return (
    <Provider
      key={isolated ? `${location.pathname}:${scenario}:${clock}:${role}` : `${role}:${reset}`}
      isolated={isolated}
      role={role}
      reset={reset}
    >
      <Outlet />
    </Provider>
  );
}
