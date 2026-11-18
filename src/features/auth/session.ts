import { useEffect, useSyncExternalStore } from 'react';
import { api, ApiRequestError, type createApiClient } from '../../api/client';
import type { SessionResponse } from '../../api/types';

export type AuthState =
  | { status: 'checking'; revision: number }
  | { status: 'authenticated'; session: SessionResponse; revision: number }
  | { status: 'anonymous'; revision: number }
  | { status: 'error'; error: unknown; revision: number };

export function createSessionStore(client: ReturnType<typeof createApiClient>) {
  let state: AuthState = { status: 'checking', revision: 0 };
  let pending: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: AuthState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  client.subscribeSession((session) => {
    publish(
      session
        ? { status: 'authenticated', session, revision: state.revision + 1 }
        : { status: 'anonymous', revision: state.revision + 1 },
    );
  });
  const refresh = () => {
    if (pending) return pending;
    const startedAtRevision = state.revision;
    pending = Promise.resolve()
      .then(() => client.getSession({ refresh: true }))
      .then(
        () => {},
        (error: unknown) => {
          // 로그아웃/사용자 변경 이후 도착한 이전 조회의 오류도 폐기한다.
          if (state.revision !== startedAtRevision) return;
          if (error instanceof ApiRequestError && error.code === 'SESSION_CHANGED') return;
          if (error instanceof ApiRequestError && error.status === 401) {
            publish({ status: 'anonymous', revision: state.revision + 1 });
          } else {
            publish({ status: 'error', error, revision: state.revision + 1 });
          }
        },
      )
      .finally(() => {
        pending = null;
      });
    return pending;
  };
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh,
  };
}

export const sessionStore = createSessionStore(api);

export function useAuthSession() {
  const state = useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot);
  useEffect(() => {
    void sessionStore.refresh();
    const refresh = () => {
      if (document.visibilityState === 'visible') void sessionStore.refresh();
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return state;
}
