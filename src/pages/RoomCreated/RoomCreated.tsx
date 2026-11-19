import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { formatCandidateDates } from '../CreateRoom/createRoomState';
import { getCreatedRoom, getJoinedParticipants } from '../../features/createdRoom/model';
import { PATHS, roomPath } from '../../router/paths';
import { useRoomBack } from '../../router/useRoomNavigation';
import Header from '../../components/common/Header/Header';
import Button from '../../components/common/Button/Button';
import MeetingInfoCard from './components/MeetingInfoCard';
import InviteCodeCopy from './components/InviteCodeCopy';
import type { MeetingInfo } from './types';
import { useRoomState } from '../../features/serverRoom/useRoomState';
import { RoomRequestStatus } from '../../features/serverRoom/RoomStatus';
import { prepareKakaoShare, shareKakaoInvite } from '../../features/serverRoom/kakaoInviteShare';
import type { CreateRoomResponse } from '../../api/types';
import Toast, { type ToastMessage } from '../../components/common/Toast/Toast';
import './RoomCreated.scss';

function MockRoomCreated() {
  const [params] = useSearchParams();
  const room = getCreatedRoom(params.get('roomId'))!;
  const { inviteCode, creation } = room;
  const meeting = {
    name: creation.name.trim(),
    candidateDates: formatCandidateDates(creation.dateRange),
    capacity: creation.capacity,
    participantCount: getJoinedParticipants(room).length,
  };

  const shareInviteOnKakao = () => {
    window.alert(
      '카카오톡 공유 SDK는 아직 연동되지 않았어요. 초대 코드나 링크를 복사해 공유해주세요.',
    );
  };

  const copyInviteLink = async () => {
    const inviteUrl = new URL(roomPath(PATHS.invitation, '', room.id), window.location.origin);
    inviteUrl.searchParams.set('code', inviteCode);

    try {
      await navigator.clipboard.writeText(inviteUrl.toString());
      window.alert(
        '개발용 초대 링크를 복사했어요. 같은 브라우저의 목 정보 확인용이며 실제 참여 API는 미연결이에요.',
      );
    } catch {
      window.alert('링크를 복사하지 못했어요. 브라우저의 클립보드 권한을 확인해주세요.');
    }
  };

  return (
    <CreatedView
      meeting={meeting}
      inviteCode={inviteCode}
      share={shareInviteOnKakao}
      copy={copyInviteLink}
    />
  );
}

function CreatedView({
  meeting,
  inviteCode,
  inviteUrl,
  share,
  copy,
  message,
  dismiss,
  onBack,
}: {
  meeting: MeetingInfo;
  inviteCode?: string;
  inviteUrl?: string;
  share: () => void;
  copy: () => void;
  message?: ToastMessage | null;
  dismiss?: () => void;
  onBack?: () => void;
}) {
  const goBack = useRoomBack(PATHS.create);
  return (
    <div className="page room-created">
      <Header title="약속방 생성 완료" showBackButton onBack={onBack ?? goBack} />
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
        <Link className="room-created__home-link" to={PATHS.home}>
          홈으로 돌아가기<span aria-hidden="true">↗</span>
        </Link>
      </footer>
      {dismiss && <Toast message={message ?? null} onDismiss={dismiss} />}
    </div>
  );
}

export default MockRoomCreated;

export function ServerRoomCreated({ roomId }: { roomId: string }) {
  const state = useRoomState(roomId);
  const navigate = useNavigate();
  const { state: navigation } = useLocation();
  const response = navigation?.createdRoom as CreateRoomResponse | undefined;
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

  const meeting = {
    name: room.title ?? '약속방',
    candidateDates: formatCandidateDates({ start: room.dates.from, end: room.dates.through }),
    capacity: room.capacity,
    participantCount: room.joinedCount,
  };
  return (
    <CreatedView
      meeting={meeting}
      inviteCode={available ? invite.code : undefined}
      inviteUrl={available ? invite.inviteUrl : undefined}
      onBack={() => navigate(PATHS.create)}
      share={() => {
        if (!available) return;
        void shareKakaoInvite(meeting.name, invite.code, invite.inviteUrl).catch(() =>
          setMessage({
            tone: 'error',
            title: '카카오톡 공유를 열지 못했어요.',
            description: '초대 링크를 복사해 공유해주세요.',
          }),
        );
      }}
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
  );
}
