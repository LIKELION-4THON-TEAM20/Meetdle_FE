import { Navigate, useLocation } from 'react-router';
import { useRoomNavigation } from '../../router/useRoomNavigation';
import { PATHS } from '../../router/paths';
import { useMockRoom } from '../../features/mockRoom/context';
import Button from '../../components/common/Button/Button';
import MeetingConfirmationLayout from './components/MeetingConfirmationLayout';
import { getMeetingConfirmation } from './confirmationData';

function MeetingConfirmed() {
  const navigate = useRoomNavigation();
  const { search } = useLocation();
  const { room } = useMockRoom();
  if (room.role !== 'host') return <Navigate to={`${PATHS.info}${search}`} replace />;

  const handleShare = () => {
    window.alert('카카오톡 공유 SDK는 아직 연동되지 않았어요. 실제 공유는 수행되지 않습니다.');
  };

  return (
    <MeetingConfirmationLayout
      meeting={getMeetingConfirmation(room)}
      onBack={() => navigate(PATHS.home)}
    >
      <footer className="meeting-confirmed__footer">
        <Button className="meeting-confirmed__action" onClick={() => navigate(PATHS.setup)}>
          장소 등록 설정하기
        </Button>
        <Button
          variant="secondary"
          className="meeting-confirmed__action meeting-confirmed__action--outline"
          onClick={handleShare}
        >
          카카오톡으로 공유하기
        </Button>
      </footer>
    </MeetingConfirmationLayout>
  );
}

export default MeetingConfirmed;
