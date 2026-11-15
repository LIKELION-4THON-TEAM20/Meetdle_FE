import { useRoomNavigation } from '../../router/useRoomNavigation';
import { PATHS } from '../../router/paths';
import { useMockRoom } from '../../features/mockRoom/context';
import Header from '../../components/common/Header/Header';
import Button from '../../components/common/Button/Button';
import MeetingConfirmationCard from './components/MeetingConfirmationCard';
import { MOCK_CONFIRMED_MEETING } from './mockData';
import './MeetingConfirmed.scss';

function MeetingConfirmed() {
  const navigate = useRoomNavigation();
  const { room } = useMockRoom();
  const meeting = {
    ...MOCK_CONFIRMED_MEETING,
    dateTime: new Intl.DateTimeFormat('ko-KR', {
      month: 'long',
      day: 'numeric',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Seoul',
    }).format(room.meetingAt),
    area: room.area,
    totalCount: room.participants.length,
  };

  const handleShare = () => {
    window.alert('카카오톡 공유 SDK는 아직 연동되지 않았어요. 실제 공유는 수행되지 않습니다.');
  };

  const handlePlaceSettings = () => {
    if (room.role === 'host') navigate(PATHS.setup);
  };

  return (
    <div className="page meeting-confirmed">
      <Header title="약속 확정" showBackButton onBack={() => navigate(PATHS.home)} />
      <main className="meeting-confirmed__content">
        <div className="meeting-confirmed__hero">
          <span className="meeting-confirmed__celebration" aria-hidden="true">
            🎉
          </span>
          <h2>우리 여기서 만나요</h2>
          <p>확정된 일시와 지역을 친구들에게 알려주세요.</p>
        </div>
        <p>개발용 목 확정 정보예요. 서버에서 확정한 결과가 아니에요.</p>
        <MeetingConfirmationCard meeting={meeting} />
      </main>
      <footer className="meeting-confirmed__footer">
        <Button className="meeting-confirmed__action" onClick={handleShare}>
          카카오톡으로 공유하기
        </Button>
        <Button
          variant="secondary"
          className="meeting-confirmed__action meeting-confirmed__action--outline"
          onClick={handlePlaceSettings}
          disabled={room.role !== 'host'}
        >
          장소 등록 설정하기
        </Button>
      </footer>
    </div>
  );
}

export default MeetingConfirmed;
