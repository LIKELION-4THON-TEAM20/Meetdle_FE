import RequestStatus from '../components/common/RequestStatus/RequestStatus';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { startKakaoLogin } from '../api/auth';
import LoginRequiredModal from '../components/common/LoginRequiredModal/LoginRequiredModal';
import { getInvitePreview, isServerRoomId } from '../api/rooms';
import type { InvitePreview } from '../api/types';
import { useAuthSession, sessionStore, type AuthState } from '../features/auth/session';
import { assertInvitePreview, invitationFlow } from '../features/auth/invitations';
import { authErrorMessage } from '../features/auth/errors';
import {
  clearMatchingLoginReturn,
  rememberLoginReturn,
  kakaoLoginOptions,
  inviteReturnPath,
  loginErrorMessage,
} from '../features/auth/loginReturn';
import { roomEntryUrl } from '../features/homeApi/model';
import Header from '../components/common/Header/Header';
import Button from '../components/common/Button/Button';
import MeetingInfoCard from '../pages/RoomCreated/components/MeetingInfoCard';
import JoinByCodeDialog from '../pages/Home/components/JoinByCodeDialog';
import AuthStatus from './AuthStatus';
import { PATHS } from './paths';
import '../pages/RoomInvitation/RoomInvitation.scss';

function InvitationContent({ auth }: { auth: AuthState }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const routeParams = useParams();
  const token = routeParams.token ?? params.get('inviteToken') ?? params.get('token') ?? undefined;
  const roomId = params.get('roomId');
  const cached =
    roomId && auth.status === 'authenticated' ? invitationFlow.peek(roomId, auth.session) : null;
  const [preview, setPreview] = useState<InvitePreview | null>(cached?.preview ?? null);
  const [loading, setLoading] = useState(!!token && !cached);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [codeOpen, setCodeOpen] = useState(false);
  const [loginStarting, setLoginStarting] = useState(false);
  const [loginError, setLoginError] = useState('');
  const joining = useRef(false);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!token) return;
    if (auth.status === 'authenticated') {
      try {
        clearMatchingLoginReturn(sessionStorage, inviteReturnPath(token));
      } catch {
        /* Storage can be unavailable. */
      }
    }
    const controller = new AbortController();
    getInvitePreview(token, controller.signal).then(
      (value) => {
        if (!controller.signal.aborted) {
          try {
            assertInvitePreview(value);
          } catch (cause) {
            setError(authErrorMessage(cause));
            setLoading(false);
            return;
          }
          setPreview(value);
          setLoading(false);
        }
      },
      (cause) => {
        if (!controller.signal.aborted) {
          setError(authErrorMessage(cause));
          setLoading(false);
        }
      },
    );
    return () => controller.abort();
  }, [token, attempt, auth.status]);
  if (auth.status === 'checking') return <AuthStatus message="로그인 상태를 확인하고 있어요." />;
  if (auth.status === 'error')
    return (
      <AuthStatus
        message={authErrorMessage(auth.error)}
        onRetry={() => void sessionStore.refresh()}
      />
    );
  const login = () => {
    const returnTo = token ? inviteReturnPath(token) : PATHS.invitation;
    if (loginStarting) return;
    setLoginError('');
    try {
      try {
        rememberLoginReturn(sessionStorage, returnTo);
      } catch {
        // The backend also retains inviteToken across OAuth.
      }
      setLoginStarting(true);
      startKakaoLogin(kakaoLoginOptions(window.location.origin, returnTo, token));
    } catch {
      setLoginStarting(false);
      setLoginError('로그인에 연결하지 못했어요. 다시 시도해주세요.');
    }
  };
  const verified =
    preview && auth.status === 'authenticated'
      ? invitationFlow.peek(preview.roomId, auth.session)
      : null;
  const join = async () => {
    if (auth.status !== 'authenticated') {
      login();
      return;
    }
    if (preview?.entryStatus === 'MEMBER') {
      navigate(roomEntryUrl(preview.roomId), { replace: true });
      return;
    }
    if (!verified) {
      setCodeOpen(true);
      return;
    }
    if (joining.current) return;
    joining.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await invitationFlow.join(verified.preview.roomId);
      if (mounted.current) navigate(roomEntryUrl(result.roomId), { replace: true });
    } catch (cause) {
      if (mounted.current) setError(authErrorMessage(cause));
    } finally {
      joining.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <div className="page room-invitation">
      <Header title="약속 초대" showBackButton onBack={() => navigate(PATHS.home)} />
      <main className="room-invitation__content">
        {loading && (
          <RequestStatus
            loading
            title="초대 정보를 불러오는 중이에요."
            description="약속방 정보를 확인하고 있어요."
          />
        )}
        {preview && (
          <>
            <div className="room-invitation__hero">
              <span className="room-invitation__letter" aria-hidden="true">
                💌
              </span>
              <h2>{preview.hostNickname}님이 약속에 초대했어요</h2>
              <p>참여하고 가능한 시간과 출발역을 알려주세요</p>
            </div>
            <MeetingInfoCard
              variant="participant"
              hostName={preview.hostNickname}
              meeting={{
                name: preview.title ?? '이름 없는 약속',
                candidateDates: `${preview.dates.from} ~ ${preview.dates.through}`,
                capacity: preview.capacity,
                participantCount: preview.joinedCount,
              }}
            />
            {preview.entryStatus === 'FULL' && (
              <p role="status">방이 가득 찼어요. 정원 {preview.capacity}명이 모두 참여했어요.</p>
            )}
            {preview.entryStatus === 'CLOSED' && <p role="status">참여가 마감된 약속이에요.</p>}
          </>
        )}
        {!preview && !loading && !error && <p>초대 코드를 입력해 약속 정보를 확인해주세요.</p>}
        {auth.status === 'anonymous' && (
          <p className="room-invitation__login-notice">
            카카오 로그인이 필요해요. 로그인하면 이 약속방으로 바로 돌아와요.
          </p>
        )}
        {loginErrorMessage(params.get('loginError')) && (
          <RequestStatus
            title="카카오 로그인을 완료하지 못했어요."
            description={loginErrorMessage(params.get('loginError')) ?? undefined}
          />
        )}
        {error && (
          <RequestStatus
            title="초대 요청을 처리하지 못했어요."
            description={error}
            onRetry={
              token
                ? () => {
                    setLoading(true);
                    setError('');
                    setAttempt((value) => value + 1);
                  }
                : undefined
            }
          />
        )}
      </main>
      <footer className="room-invitation__footer">
        <Button
          disabled={
            loading || busy || preview?.entryStatus === 'FULL' || preview?.entryStatus === 'CLOSED'
          }
          aria-busy={busy}
          onClick={() => void join()}
        >
          {busy
            ? '참여 확인 중…'
            : auth.status === 'anonymous'
              ? '카카오 로그인하기'
              : preview?.entryStatus === 'MEMBER'
                ? '약속방으로 이동'
                : verified
                  ? '참여하기'
                  : '초대 코드 확인하기'}
        </Button>
      </footer>
      <LoginRequiredModal
        open={auth.status === 'anonymous'}
        dismissible={false}
        onClose={() => {}}
        onKakaoLogin={login}
        busy={loginStarting}
        error={loginError || loginErrorMessage(params.get('loginError'))}
      />
      {codeOpen && (
        <JoinByCodeDialog
          onClose={() => setCodeOpen(false)}
          onSubmitCode={async (code) => {
            try {
              const resolved = await invitationFlow.resolve(code, token);
              if (roomId && isServerRoomId(roomId) && resolved.preview.roomId !== roomId)
                return { status: 'error', message: '이 초대와 일치하는 코드를 입력해주세요.' };
              setPreview(resolved.preview);
              if (resolved.preview.entryStatus === 'FULL')
                return { status: 'room-full', capacity: resolved.preview.capacity };
              if (resolved.preview.entryStatus === 'CLOSED')
                return { status: 'error', message: '참여가 마감된 약속이에요.' };
              setCodeOpen(false);
            } catch (cause) {
              return { status: 'error', message: authErrorMessage(cause) };
            }
          }}
        />
      )}
    </div>
  );
}

export default function InvitationRoute() {
  const auth = useAuthSession();
  const [params] = useSearchParams();
  const routeParams = useParams();
  const identity =
    auth.status === 'authenticated'
      ? `${auth.session.user.userId}:${auth.session.csrfToken}`
      : auth.status;
  const token = routeParams.token ?? params.get('inviteToken') ?? params.get('token');
  if (token !== null && token !== undefined && !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return <AuthStatus message="초대 링크를 확인해주세요." />;
  }
  return (
    <InvitationContent
      key={`${identity}:${params.toString()}:${routeParams.token ?? ''}`}
      auth={auth}
    />
  );
}
