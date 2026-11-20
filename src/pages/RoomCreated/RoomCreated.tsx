import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { formatCandidateDates } from '../CreateRoom/createRoomState';
import { PATHS } from '../../router/paths';
import Header from '../../components/common/Header/Header';
import Button from '../../components/common/Button/Button';
import MeetingInfoCard from './components/MeetingInfoCard';
import InviteCodeCopy from './components/InviteCodeCopy';
import type { MeetingInfo } from './types';
import { useRoomState } from '../../features/serverRoom/useRoomState';
import { serverRoomUrl, serverScreenUrl, roomScreen } from '../../features/serverRoom/routing';
import { RoomRequestStatus } from '../../features/serverRoom/RoomStatus';
import { prepareKakaoShare } from '../../features/serverRoom/kakaoInviteShare';
import type { CreateRoomResponse } from '../../api/types';
import Toast, { type ToastMessage } from '../../components/common/Toast/Toast';
import './RoomCreated.scss';
import RoomShareDialog from '../../features/sharing/RoomShareDialog';

function CreatedView({
  meeting,
  inviteCode,
  inviteUrl,
  share,
  copy,
  message,
  dismiss,
}: {
  meeting: MeetingInfo;
  inviteCode?: string;
  inviteUrl?: string;
  share: () => void;
  copy: () => void;
  message?: ToastMessage | null;
  dismiss?: () => void;
}) {
  const navigate = useNavigate();
  return (
    <div className="page room-created">
      <Header
        title="약속방 생성 완료"
        showBackButton
        onBack={() => navigate(PATHS.home, { replace: true })}
      />
      <main className="room-created__content">
        <div className="room-created__intro">
          <h2>약속 방이 생성되었어요!</h2>
          <p>친구들을 초대하고 함께 일정을 맞춰보세요</p>
        </div>
        <MeetingInfoCard meeting={meeting} />
        {inviteCode && <InviteCodeCopy code={inviteCode} onShare={share} />}
        {!inviteCode && <p>이 약속방의 초대가 마감되었거나 초대 정보를 볼 수 없어요.</p>}
      </main>
      <footer className="room-created__footer">
        <Button className="room-created__action" onClick={share} disabled={!inviteCode}>
          카카오톡으로 초대하기
        </Button>
        <Button
          variant="secondary"
          className="room-created__action room-created__action--link"
          onClick={copy}
          disabled={!inviteCode}
          title={inviteUrl}
        >
          링크 복사하기
        </Button>
        <Link className="room-created__home-link" to={PATHS.home} replace>
          홈으로 돌아가기<span aria-hidden="true">↗</span>
        </Link>
      </footer>
      {dismiss && <Toast message={message ?? null} onDismiss={dismiss} />}
    </div>
  );
}

export function ServerRoomCreated({ roomId }: { roomId: string }) {
  const state = useRoomState(roomId, true);
  const { state: navigation } = useLocation();
  const response = navigation?.createdRoom as CreateRoomResponse | undefined;
  const [shareOpen, setShareOpen] = useState(false);
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const dismiss = useCallback(() => setMessage(null), []);
  const room = state.room;
  const current = room?.me.role === 'HOST' ? room.invite : null;
  const invite =
    current &&
    response?.roomId === roomId &&
    response.invite?.code === current.code &&
    response.invite.inviteUrl === current.inviteUrl &&
    response.invite.expiresAt === current.expiresAt
      ? response.invite
      : current;
  const available =
    invite && state.serverNow !== null && Date.parse(invite.expiresAt) > state.serverNow;

  useEffect(() => {
    if (available) void prepareKakaoShare().catch(() => undefined);
  }, [available]);

  if (!room || state.error) {
    return (
      <RoomRequestStatus roomId={roomId} error={state.error} retry={() => void state.refresh()} />
    );
  }

  if (room.me.role !== 'HOST' || room.phase !== 'WAITING_FOR_DEPARTURE')
    return <Navigate to={serverRoomUrl(roomId)} replace />;
  if (room.joinedCount > 1 || room.startedAt)
    return <Navigate to={serverScreenUrl(roomScreen(room), roomId)} replace />;

  const meeting = {
    name: room.title ?? '약속방',
    candidateDates: formatCandidateDates({ start: room.dates.from, end: room.dates.through }),
    capacity: room.capacity,
    participantCount: room.joinedCount,
  };
  return (
    <>
      {' '}
      <CreatedView
        meeting={meeting}
        inviteCode={available ? invite.code : undefined}
        inviteUrl={available ? invite.inviteUrl : undefined}
        share={() => setShareOpen(true)}
        copy={() => {
          if (!available) return;
          void (async () => {
            try {
              await navigator.clipboard.writeText(invite.inviteUrl);
              setMessage({
                tone: 'success',
                title: '초대 링크를 복사했어요.',
                description: invite.inviteUrl,
              });
            } catch {
              setMessage({
                tone: 'error',
                title: '링크를 복사하지 못했어요.',
                description: '브라우저의 클립보드 권한을 확인해주세요.',
              });
            }
          })();
        }}
        message={message}
        dismiss={dismiss}
      />
      {shareOpen && (
        <RoomShareDialog roomId={roomId} kind="invite" onClose={() => setShareOpen(false)} />
      )}
    </>
  );
}
