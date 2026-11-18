import { useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { useRoomNavigation } from '../../router/useRoomNavigation';
import { getCreatedRoom } from '../../features/createdRoom/model';
import type { ScheduleTransitInput } from '../ScheduleTransit/types';
import Header from '../../components/common/Header/Header';
import Button from '../../components/common/Button/Button';
import ParticipantList from './components/ParticipantList';
import ParticipationSummary from './components/ParticipationSummary';
import IncompleteParticipantsModal from './components/IncompleteParticipantsModal';
import ParticipationShareModal from './components/ParticipationShareModal';
import { getMockParticipants } from './mockData';
import { getParticipationActions, MINIMUM_COMPLETED_COUNT } from './participationPolicy';
import './ParticipationStatus.scss';
import { PATHS } from '../../router/paths';

function ParticipationStatus() {
  const navigate = useRoomNavigation();
  const [searchParams] = useSearchParams();
  const { state } = useLocation();
  const [showIncompleteModal, setShowIncompleteModal] = useState(false);
  const [shareKind, setShareKind] = useState<'reminder' | 'notifyHost' | null>(null);

  const isHost = searchParams.get('role') !== 'participant';
  const scenario = import.meta.env.DEV ? searchParams.get('scenario') : null;
  const submittedInput: ScheduleTransitInput | undefined = state?.scheduleInput;
  const roomId = getCreatedRoom(searchParams.get('roomId'))?.id;
  const currentParticipantId = isHost ? 'sangmin' : 'haneul';
  const participants = getMockParticipants(scenario).map((participant) =>
    !scenario && submittedInput?.roomId === roomId && participant.id === currentParticipantId
      ? { ...participant, status: 'completed' as const }
      : participant,
  );
  const completedParticipants = participants.filter(({ status }) => status === 'completed');
  const completedCount = completedParticipants.length;
  const incompleteParticipants = participants.filter(({ status }) => status !== 'completed');
  const totalCount = participants.length;
  const { meetsMinimum, allCompleted, showReminder, showHostNotification, canNotifyHost } =
    getParticipationActions(completedCount, totalCount);
  const canProceed = isHost && meetsMinimum;
  const canShare = shareKind === 'reminder' ? showReminder : canNotifyHost;
  const incompleteNames = incompleteParticipants.map(({ name }) => name).join(', ');
  let summary = `${incompleteNames} 님이 아직 가능 시간을 입력하지 않았어요`;
  if (allCompleted) summary = '참여 인원 모두가 입력을 완료했어요!';
  else if (isHost && !meetsMinimum) {
    summary = `최소 ${MINIMUM_COMPLETED_COUNT}명 이상 입력을 완료해야 후보를 계산할 수 있어요.`;
  }

  const proceedWithCompletedParticipants = () => {
    if (!canProceed) return;
    setShowIncompleteModal(false);
    navigate(PATHS.candidates, { state: { completedParticipants } });
  };

  const handleProceed = () => {
    if (!canProceed) return;
    if (incompleteParticipants.length > 0) setShowIncompleteModal(true);
    else proceedWithCompletedParticipants();
  };

  return (
    <div className="page participation-status">
      <Header title="참여 현황" showBackButton onBack={() => navigate(PATHS.home)} />
      <main className="participation-status__content">
        <ParticipationSummary
          count={completedCount}
          total={totalCount}
          label="입력 완료"
          description={summary}
        />
        <ParticipantList participants={participants} />
      </main>
      <footer className="participation-status__footer">
        {isHost ? (
          <Button
            className="participation-status__proceed"
            disabled={!canProceed}
            onClick={handleProceed}
          >
            {allCompleted ? '약속 장소 확인하기' : '지금까지 입력한 후보로 진행'}
          </Button>
        ) : (
          <>
            {showReminder && (
              <Button onClick={() => setShareKind('reminder')}>입력 재촉하기</Button>
            )}
            {showHostNotification && (
              <Button disabled={!canNotifyHost} onClick={() => setShareKind('notifyHost')}>
                방장에게 알리기
              </Button>
            )}
          </>
        )}
      </footer>
      <IncompleteParticipantsModal
        open={canProceed && !allCompleted && showIncompleteModal}
        participants={incompleteParticipants}
        onClose={() => setShowIncompleteModal(false)}
        onProceed={proceedWithCompletedParticipants}
      />
      <ParticipationShareModal
        kind={!isHost && canShare ? shareKind : null}
        onClose={() => setShareKind(null)}
      />
    </div>
  );
}

export default ParticipationStatus;
