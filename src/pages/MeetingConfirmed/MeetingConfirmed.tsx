import { useNavigate } from 'react-router';
import Header from '../../components/common/Header/Header';
import Button from '../../components/common/Button/Button';
import MeetingConfirmationCard from './components/MeetingConfirmationCard';
import { MOCK_CONFIRMED_MEETING } from './mockData';
import './MeetingConfirmed.scss';

function MeetingConfirmed() {
  const navigate = useNavigate();

  const handleShare = () => {
    window.alert('카카오톡 공유 SDK는 아직 연동되지 않았어요. 실제 공유는 수행되지 않습니다.');
  };

  const handlePlaceSettings = () => {
    // Replace with SCREEN 08 navigation when that screen is implemented.
    window.alert('장소 등록 설정 화면은 준비 중이에요. 아직 설정 화면으로 이동할 수 없습니다.');
  };

  return (
    <div className="page meeting-confirmed">
      <Header title="약속 확정" showBackButton onBack={() => navigate(-1)} />
      <main className="meeting-confirmed__content">
        <div className="meeting-confirmed__hero">
          <span className="meeting-confirmed__celebration" aria-hidden="true">
            🎉
          </span>
          <h2>우리 여기서 만나요</h2>
          <p>확정된 일시와 지역을 친구들에게 알려주세요.</p>
        </div>
        <MeetingConfirmationCard meeting={MOCK_CONFIRMED_MEETING} />
      </main>
      <footer className="meeting-confirmed__footer">
        <Button className="meeting-confirmed__action" onClick={handleShare}>
          카카오톡으로 공유하기
        </Button>
        <Button
          variant="secondary"
          className="meeting-confirmed__action meeting-confirmed__action--outline"
          onClick={handlePlaceSettings}
        >
          장소 등록 설정하기
        </Button>
      </footer>
    </div>
  );
}

export default MeetingConfirmed;
