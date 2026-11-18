import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import Home from '../pages/Home/Home';
import { logout } from '../api/auth';
import { ApiRequestError } from '../api/client';
import type { SessionResponse } from '../api/types';
import { useAuthSession, sessionStore } from '../features/auth/session';
import { invitationFlow } from '../features/auth/invitations';
import { authErrorMessage } from '../features/auth/errors';
import { consumeLoginReturn, loginErrorMessage } from '../features/auth/loginReturn';
import { toAppointment } from '../features/homeApi/model';
import { useRoomList } from '../features/homeApi/useRoomList';
import type { AppointmentFilter } from '../pages/Home/appointment.types';
import { PATHS } from './paths';
import AuthStatus from './AuthStatus';

function AuthenticatedHome({ session, revision }: { session: SessionResponse; revision: number }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [filter, setFilter] = useState<AppointmentFilter>('all');
  const scope = { all: 'ALL', upcoming: 'UPCOMING', past: 'PAST' } as const;
  const rooms = useRoomList(scope[filter], revision);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (params.has('loginError')) return;
    try {
      const destination = consumeLoginReturn(sessionStorage);
      if (destination !== PATHS.home) navigate(destination, { replace: true });
    } catch {
      /* A normal home visit does not require browser storage. */
    }
  }, [navigate, params]);
  if (loggingOut) return <AuthStatus message="로그아웃하고 있어요." />;
  return (
    <Home
      key={session.user.userId}
      appointments={rooms.items.map(toAppointment)}
      filter={filter}
      onFilterChange={setFilter}
      loading={rooms.loading}
      error={error || (rooms.error ? authErrorMessage(rooms.error) : '')}
      notice={loginErrorMessage(params.get('loginError'))}
      onRetry={rooms.nextCursor && rooms.items.length ? rooms.loadMore : rooms.retry}
      hasMore={!!rooms.nextCursor}
      onLoadMore={rooms.loadMore}
      allowDelete={false}
      onLogout={() => {
        if (loggingOut) return;
        setLoggingOut(true);
        setError('');
        void logout().then(
          () => {
            invitationFlow.clear();
            navigate(PATHS.login, { replace: true });
          },
          (cause: unknown) => {
            setLoggingOut(false);
            setError(authErrorMessage(cause));
          },
        );
      }}
      onJoinByCode={async (code) => {
        try {
          const resolved = await invitationFlow.resolve(code);
          if (!mounted.current) return;
          if (resolved.preview.entryStatus === 'FULL')
            return { status: 'room-full', capacity: resolved.preview.capacity };
          if (resolved.preview.entryStatus === 'CLOSED')
            return { status: 'error', message: '참여가 마감된 약속이에요.' };
          navigate(`${PATHS.invitation}?roomId=${encodeURIComponent(resolved.preview.roomId)}`);
        } catch (cause) {
          if (cause instanceof ApiRequestError && cause.code === 'INVALID_INVITATION')
            return 'invalid-code';
          return { status: 'error', message: authErrorMessage(cause) };
        }
      }}
    />
  );
}

export default function HomeRoute() {
  const auth = useAuthSession();
  const [params] = useSearchParams();
  if (auth.status === 'checking') return <AuthStatus message="로그인 상태를 확인하고 있어요." />;
  if (auth.status === 'anonymous')
    return (
      <Navigate
        to={`${PATHS.login}${params.has('loginError') ? `?loginError=${encodeURIComponent(params.get('loginError')!)}` : ''}`}
        replace
      />
    );
  if (auth.status === 'error')
    return (
      <AuthStatus
        message={authErrorMessage(auth.error)}
        onRetry={() => void sessionStore.refresh()}
      />
    );
  return (
    <AuthenticatedHome
      key={`${auth.session.user.userId}:${auth.session.csrfToken}`}
      session={auth.session}
      revision={auth.revision}
    />
  );
}
