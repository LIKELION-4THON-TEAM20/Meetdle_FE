import Header from '../../components/common/Header/Header';
import Button from '../../components/common/Button/Button';
import MeetingInfoCard from '../RoomCreated/components/MeetingInfoCard';
import participantAvatars from '../../assets/icons/room-invitation/participants.svg';
import { MOCK_ROOM_INVITATION } from './mockData';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { findCreatedRoomByCode, getCreatedRoom } from '../../features/createdRoom/model';
import { formatCandidateDates } from '../CreateRoom/createRoomState';
import { PATHS } from '../../router/paths';
import './RoomInvitation.scss';

function RoomInvitation() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const room = params.has('roomId')
    ? getCreatedRoom(params.get('roomId'))
    : params.has('code')
      ? findCreatedRoomByCode(params.get('code')!)
      : undefined;
  const { hostName } = MOCK_ROOM_INVITATION;
  const meeting = room
    ? {
        name: room.creation.name,
        candidateDates: formatCandidateDates(room.creation.dateRange),
        capacity: room.creation.capacity,
        participantCount: 1,
      }
    : MOCK_ROOM_INVITATION.meeting;

  const handleJoin = () => {
    const returnTo = `${location.pathname}${location.search}`;
    navigate(`${PATHS.login}?returnTo=${encodeURIComponent(returnTo)}`);
  };

  return (
    <div className="page room-invitation">
      <Header title="약속 초대" showBackButton onBack={() => navigate(PATHS.home)} />
      <main className="room-invitation__content">
        <div className="room-invitation__hero">
          <span className="room-invitation__letter" aria-hidden="true">
            💌
          </span>
          <h2>{hostName}님이 약속에 초대했어요</h2>
          <p>참여하고 가능한 시간과 출발역을 알려주세요</p>
        </div>
        <MeetingInfoCard
          variant="participant"
          meeting={meeting}
          hostName={hostName}
          participantAvatarsSrc={participantAvatars}
        />
        <p className="room-invitation__login-notice">
          카카오 로그인이 필요해요. 로그인하면 이 약속방으로 바로 돌아와요.
        </p>
        <p className="room-invitation__login-notice">
          개발용 목 초대예요. 실제 코드 확인·로그인 후 복귀·참여 API는 미연결이에요.
        </p>
      </main>
      <footer className="room-invitation__footer">
        <Button onClick={handleJoin}>참여하기</Button>
      </footer>
    </div>
  );
}

export default RoomInvitation;
