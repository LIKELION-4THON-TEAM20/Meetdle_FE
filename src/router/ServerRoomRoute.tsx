import { clearMatchingLoginReturn } from '../features/auth/loginReturn';
import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { getRoomState, isServerRoomId } from '../api/rooms';
import type { RoomState } from '../api/types';
import { useAuthSession, sessionStore } from '../features/auth/session';
import { authErrorMessage } from '../features/auth/errors';
import { phaseLabel } from '../features/homeApi/model';
import Header from '../components/common/Header/Header';
import AuthStatus from './AuthStatus';
import { PATHS } from './paths';

function ServerRoom({ roomId, revision }: { roomId: string; revision: number }) {
  const [state, setState] = useState<RoomState | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    try {
      clearMatchingLoginReturn(sessionStorage, `/rooms/${roomId}`);
    } catch {
      /* Storage can be unavailable. */
    }
    const controller = new AbortController();
    getRoomState(roomId, controller.signal).then(
      (value) => {
        if (!controller.signal.aborted) setState(value);
      },
      (cause) => {
        if (!controller.signal.aborted) setError(authErrorMessage(cause));
      },
    );
    return () => controller.abort();
  }, [roomId, revision, attempt]);
  if (error)
    return (
      <AuthStatus
        message={error}
        onRetry={() => {
          setState(null);
          setError('');
          setAttempt((value) => value + 1);
        }}
      />
    );
  if (!state) return <AuthStatus message="약속방 정보를 확인하고 있어요." />;
  return (
    <div className="page">
      <Header title="약속 정보" />
      <main className="auth-status">
        <h2>{state.title ?? '이름 없는 약속'}</h2>
        <p>{phaseLabel(state.phase)}</p>
        <p>
          {state.joinedCount} / {state.capacity}명 참여 중
        </p>
        <p>
          후보 날짜: {state.dates.from} ~ {state.dates.through}
        </p>
        <p>일정·후보·장소 화면의 서버 연동은 준비 중이에요.</p>
        <Link to={PATHS.home}>내 약속 홈으로 이동</Link>
      </main>
    </div>
  );
}

export default function ServerRoomRoute() {
  const { roomId = '' } = useParams();
  const auth = useAuthSession();
  if (!isServerRoomId(roomId)) return <AuthStatus message="약속방 주소를 확인해주세요." />;
  if (auth.status === 'checking') return <AuthStatus message="로그인 상태를 확인하고 있어요." />;
  if (auth.status === 'anonymous')
    return (
      <Navigate to={`${PATHS.login}?returnTo=${encodeURIComponent(`/rooms/${roomId}`)}`} replace />
    );
  if (auth.status === 'error')
    return (
      <AuthStatus
        message={authErrorMessage(auth.error)}
        onRetry={() => void sessionStore.refresh()}
      />
    );
  return (
    <ServerRoom
      key={`${roomId}:${auth.session.user.userId}:${auth.session.csrfToken}:${auth.revision}`}
      roomId={roomId}
      revision={auth.revision}
    />
  );
}
