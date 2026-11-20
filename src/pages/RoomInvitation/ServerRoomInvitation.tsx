import RequestStatus from '../../components/common/RequestStatus/RequestStatus';
import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { startKakaoLogin } from '../../api/auth';
import { api, ApiRequestError } from '../../api/client';
import { isServerRoomId } from '../../api/rooms';
import type { InvitePreview, ResolvedInvite } from '../../api/types';
import Button from '../../components/common/Button/Button';
import Header from '../../components/common/Header/Header';
import {
  invitationError,
  isInviteToken,
  joinResolvedInvitation,
  loadInvitation,
  normalizeInviteCode,
  resolveInvitationCode,
} from '../../features/serverRoom/invitation';
import { serverRoomUrl } from '../../features/serverRoom/routing';
import { PATHS } from '../../router/paths';
import { formatCandidateDates } from '../CreateRoom/createRoomState';
import MeetingInfoCard from '../RoomCreated/components/MeetingInfoCard';
import './RoomInvitation.scss';

type InvitationData = Awaited<ReturnType<typeof loadInvitation>>;
const blocked: Partial<Record<InvitePreview['entryStatus'], string>> = {
  FULL: '약속방의 정원이 찼어요.',
  CLOSED: '이 약속방의 참여가 마감됐어요.',
};

function InviteScreen({ token }: { token: string }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<InvitationData | null>(null);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [code, setCode] = useState('');
  const [resolved, setResolved] = useState<ResolvedInvite | null>(null);
  const [destination, setDestination] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  const running = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    active.current = controller;
    let sessionObserved = false;
    void loadInvitation(token, controller.signal).then(
      (value) => {
        if (!controller.signal.aborted) {
          sessionObserved = value.session !== null;
          setData(value);
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setLoadError(invitationError(error, 'preview'));
      },
    );
    const unsubscribe = api.subscribeSession(() => {
      if (!sessionObserved) return;
      sessionObserved = false;
      controller.abort();
      setData(null);
      setResolved(null);
      setDestination(null);
      setCode('');
      setBusy(false);
      setActionError('');
      setAttempt((value) => value + 1);
    });
    return () => {
      unsubscribe();
      controller.abort();
      running.current = false;
    };
  }, [attempt, token]);

  const retry = () => {
    setData(null);
    setLoadError('');
    setActionError('');
    setResolved(null);
    setAttempt((value) => value + 1);
  };

  const perform = async (step: 'code' | 'join') => {
    if (!data?.session || !isServerRoomId(data.preview.roomId) || running.current) return;
    if ((resolved?.preview ?? data.preview).entryStatus !== 'OPEN') return;
    running.current = true;
    setBusy(true);
    setActionError('');
    const signal = active.current?.signal;
    const stillCurrent = () => !signal?.aborted;
    try {
      if (step === 'code') {
        const value = await resolveInvitationCode(token, data.preview.roomId, code);
        if (stillCurrent()) setResolved(value);
      } else if (resolved) {
        const id = await joinResolvedInvitation(resolved, data.session, signal);
        if (stillCurrent()) setDestination(serverRoomUrl(id));
      }
    } catch (error) {
      if (!stillCurrent()) return;
      setActionError(invitationError(error, step));
      if (error instanceof ApiRequestError) {
        if (step === 'join' && [404, 409, 410].includes(error.status ?? 0)) setResolved(null);
        if (error.code === 'ROOM_FULL' || error.code === 'JOIN_CLOSED') {
          const entryStatus = error.code === 'ROOM_FULL' ? 'FULL' : 'CLOSED';
          setData({ ...data, preview: { ...data.preview, entryStatus } });
        }
      }
    } finally {
      if (stillCurrent()) {
        running.current = false;
        setBusy(false);
      }
    }
  };

  const preview = resolved?.preview ?? data?.preview;
  if (destination) return <Navigate to={destination} replace />;
  if (preview?.entryStatus === 'MEMBER' && data?.session && isServerRoomId(preview.roomId)) {
    return <Navigate to={serverRoomUrl(preview.roomId)} replace />;
  }

  const unavailable = preview && blocked[preview.entryStatus];
  const loginError = params.get('loginError');
  return (
    <div className="page room-invitation">
      <Header title="약속 초대" showBackButton onBack={() => navigate(PATHS.home)} />
      <main className="room-invitation__content">
        {!preview && (
          <p role={loadError ? 'alert' : 'status'}>
            {loadError || '초대 정보를 불러오는 중이에요.'}
          </p>
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
                name: preview.title ?? '약속방',
                candidateDates: formatCandidateDates({
                  start: preview.dates.from,
                  end: preview.dates.through,
                }),
                capacity: preview.capacity,
                participantCount: preview.joinedCount,
              }}
            />
            {unavailable && (
              <p role="status" className="room-invitation__login-notice">
                {unavailable}
              </p>
            )}
            {!unavailable && !data?.session && (
              <p className="room-invitation__login-notice">
                카카오 로그인 후 초대 코드를 확인할 수 있어요.
              </p>
            )}
            {!unavailable && data?.session && (
              <form
                id="server-invite-code"
                className="room-invitation__code"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!resolved && normalizeInviteCode(code)) void perform('code');
                }}
              >
                <label htmlFor="invitation-code">초대 코드</label>
                <input
                  id="invitation-code"
                  value={code}
                  maxLength={12}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={busy}
                  onChange={(event) => {
                    setCode(event.target.value);
                    setResolved(null);
                    setActionError('');
                  }}
                />
              </form>
            )}
            {resolved && !unavailable && (
              <p role="status">초대 코드를 확인했어요. 참여하기를 눌러주세요.</p>
            )}
          </>
        )}
        {actionError && (
          <RequestStatus title="약속방에 참여하지 못했어요." description={actionError} />
        )}
        {loginError && !data?.session && (
          <p role="alert">
            {loginError === 'CANCELLED'
              ? '카카오 로그인이 취소됐어요.'
              : '카카오 로그인에 실패했어요.'}
          </p>
        )}
      </main>
      <footer className="room-invitation__footer">
        {loadError && <Button onClick={retry}>다시 시도</Button>}
        {preview && !data?.session && (
          <Button
            onClick={() =>
              startKakaoLogin({ inviteToken: token, returnOrigin: window.location.origin })
            }
          >
            카카오 로그인
          </Button>
        )}
        {preview &&
          !unavailable &&
          data?.session &&
          (resolved ? (
            <Button disabled={busy} onClick={() => void perform('join')}>
              {busy ? '참여 중…' : '참여하기'}
            </Button>
          ) : (
            <Button
              type="submit"
              form="server-invite-code"
              disabled={busy || !normalizeInviteCode(code)}
            >
              {busy ? '확인 중…' : '초대 코드 확인'}
            </Button>
          ))}
      </footer>
    </div>
  );
}

export default function ServerRoomInvitation() {
  const { inviteToken: token = '' } = useParams();
  if (!isInviteToken(token)) {
    return (
      <div className="page room-invitation">
        <Header title="약속 초대" />
        <main className="room-invitation__content">
          <p role="alert">초대 링크를 찾을 수 없어요.</p>
        </main>
      </div>
    );
  }
  return <InviteScreen key={token} token={token} />;
}
