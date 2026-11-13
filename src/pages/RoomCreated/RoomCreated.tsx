import { useLocation, useNavigate } from 'react-router';
import { formatCandidateDates, isCreateRoomState } from '../CreateRoom/createRoomState';
import Header from '../../components/common/Header/Header';
import Button from '../../components/common/Button/Button';
import MeetingInfoCard from './components/MeetingInfoCard';
import InviteCodeCopy from './components/InviteCodeCopy';
import { MOCK_CREATED_ROOM } from './mockData';
import './RoomCreated.scss';

function RoomCreated() {
  const navigate = useNavigate();
  const location = useLocation();
  const state: unknown = location.state;
  const { inviteCode } = MOCK_CREATED_ROOM;
  const meeting = isCreateRoomState(state)
    ? {
        name: state.name.trim(),
        candidateDates: formatCandidateDates(state.dateRange),
        capacity: state.capacity,
        participantCount: 1,
      }
    : MOCK_CREATED_ROOM.meeting;

  const copyInviteLink = async () => {
    // UI publishing placeholder: the invitation destination is not implemented yet.
    const inviteUrl = new URL('/rooms/join', window.location.origin);
    inviteUrl.searchParams.set('code', inviteCode);

    try {
      await navigator.clipboard.writeText(inviteUrl.toString());
      window.alert(
        '임시 초대 링크를 복사했어요. 초대 링크로 입장하는 기능은 아직 연동되지 않았어요.',
      );
    } catch {
      window.alert('링크를 복사하지 못했어요. 브라우저의 클립보드 권한을 확인해주세요.');
    }
  };

  return (
    <div className="page room-created">
      <Header title="약속방 생성 완료" showBackButton onBack={() => navigate('/rooms/create')} />
      <main className="room-created__content">
        <div className="room-created__intro">
          <h2>약속 방이 생성되었어요!</h2>
          <p>친구들을 초대하고 함께 일정을 맞춰보세요</p>
        </div>
        <MeetingInfoCard meeting={meeting} />
        <InviteCodeCopy code={inviteCode} />
      </main>
      <footer className="room-created__footer">
        <Button
          className="room-created__action"
          onClick={() =>
            window.alert(
              '카카오톡 공유 SDK는 아직 연동되지 않았어요. 초대 코드나 링크를 복사해 공유해주세요.',
            )
          }
        >
          카카오톡으로 초대하기
        </Button>
        <Button
          variant="secondary"
          className="room-created__action room-created__action--link"
          onClick={copyInviteLink}
        >
          링크 복사하기
        </Button>
      </footer>
    </div>
  );
}

export default RoomCreated;
