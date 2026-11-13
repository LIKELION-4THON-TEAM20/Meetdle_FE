import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import Header from '../../components/common/Header/Header';
import Button from '../../components/common/Button/Button';
import ParticipantList from './components/ParticipantList';
import IncompleteParticipantsModal from './components/IncompleteParticipantsModal';
import { getMockParticipants } from './mockData';
import './ParticipationStatus.scss';

function ParticipationStatus() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showIncompleteModal, setShowIncompleteModal] = useState(false);
  
  const participants = getMockParticipants(
    import.meta.env.DEV ? searchParams.get('scenario') : null,
  );
  const completedCount = participants.filter(({ status }) => status === 'completed').length;
  const incompleteParticipants = participants.filter(({ status }) => status !== 'completed');
  const totalCount = participants.length;
  const progress = totalCount === 0 ? 0 : (completedCount / totalCount) * 100;
  const canProceed = completedCount >= 2;

  const proceedWithCompletedParticipants = () => {
    if (!canProceed) return;
    setShowIncompleteModal(false);
    window.alert(
      '개발용 안내: 후보 계산 API와 다음 단계는 아직 연동되지 않았어요. 실제 후보 계산은 수행하지 않습니다.',
    );
  };

  const handleProceed = () => {
    if (!canProceed) return;
    if (incompleteParticipants.length > 0) setShowIncompleteModal(true);
    else proceedWithCompletedParticipants();
  };

  return (
    <div className="page participation-status">
      <Header title="참여 현황" showBackButton onBack={() => navigate('/rooms/create/complete')} />
      <main className="participation-status__content">
        <section
          className="participation-status__summary"
          aria-labelledby="participation-status-title"
        >
          <h2 id="participation-status-title">
            <span>
              {completedCount} / {totalCount}명
            </span>{' '}
            입력 완료
          </h2>
          <p>
            {incompleteParticipants.length > 0
              ? `${incompleteParticipants.map(({ name }) => `${name} 님`).join(', ')}이 아직 가능 시간을 입력하지 않았어요`
              : '모든 친구가 입력을 완료했어요'}
          </p>
          {!canProceed && (
            <p className="participation-status__minimum">
              최소 2명 이상 입력을 완료해야 후보를 계산할 수 있어요.
            </p>
          )}
          <div
            className="participation-status__progress"
            role="progressbar"
            aria-label="참여자 입력 완료율"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-valuetext={`${totalCount}명 중 ${completedCount}명 입력 완료`}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
        </section>
        <ParticipantList participants={participants} />
      </main>
      <footer className="participation-status__footer">
        <Button
          className="participation-status__proceed"
          disabled={!canProceed}
          onClick={handleProceed}
        >
          지금까지 입력한 후보로 진행
        </Button>
      </footer>
      <IncompleteParticipantsModal
        open={showIncompleteModal}
        participants={incompleteParticipants}
        onClose={() => setShowIncompleteModal(false)}
        onProceed={proceedWithCompletedParticipants}
      />
    </div>
  );
}

export default ParticipationStatus;
