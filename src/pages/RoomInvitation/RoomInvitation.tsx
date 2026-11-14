import Header from '../../components/common/Header/Header';
import Button from '../../components/common/Button/Button';
import MeetingInfoCard from '../RoomCreated/components/MeetingInfoCard';
import participantAvatars from '../../assets/icons/room-invitation/participants.svg';
import { MOCK_ROOM_INVITATION } from './mockData';
import './RoomInvitation.scss';

function RoomInvitation() {
  const { hostName, meeting } = MOCK_ROOM_INVITATION;

  const handleJoin = () => {
    window.alert(
      '개발용 미리보기입니다. 카카오 로그인과 약속방 참여 API는 아직 연동되지 않았어요.',
    );
  };

  return (
    <div className="page room-invitation">
      <Header title="약속 초대" />
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
      </main>
      <footer className="room-invitation__footer">
        <Button onClick={handleJoin}>참여하기</Button>
      </footer>
    </div>
  );
}

export default RoomInvitation;
