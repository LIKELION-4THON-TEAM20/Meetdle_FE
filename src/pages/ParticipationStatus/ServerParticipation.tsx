import RequestStatus from '../../components/common/RequestStatus/RequestStatus';
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { RoomState } from '../../api/types';
import Header from '../../components/common/Header/Header';
import Button from '../../components/common/Button/Button';
import Modal from '../../components/common/Modal/Modal';
import RoomShareDialog from '../../features/sharing/RoomShareDialog';
import { serverScreenUrl } from '../../features/serverRoom/routing';
import type { useRoomState } from '../../features/serverRoom/useRoomState';
import { PATHS } from '../../router/paths';
import ParticipantList from './components/ParticipantList';
import ParticipationSummary from './components/ParticipationSummary';
import IncompleteParticipantsModal from './components/IncompleteParticipantsModal';
import {
  createParticipationCommands,
  participationError,
  participationModel,
} from './serverParticipationModel';
import './ParticipationStatus.scss';
import './RoomRecruitment.scss';

type ShareKind = 'reminder' | 'notifyHost';

export default function ServerParticipation({
  room,
  state,
  recruitment,
}: {
  room: RoomState;
  state: ReturnType<typeof useRoomState>;
  recruitment: boolean;
}) {
  const navigate = useNavigate();
  const model = participationModel(room);
  const [commands] = useState(createParticipationCommands);
  const [confirm, setConfirm] = useState<'start' | 'calculate' | null>(null);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [error, setError] = useState('');
  const [shareKind, setShareKind] = useState<ShareKind | null>(null);
  const run = async (intent: 'start' | 'calculate') => {
    if (running.current || state.loading) return;
    running.current = true;
    setBusy(true);
    setConfirm(null);
    setError('');
    try {
      if (intent === 'start') await state.mutate('START_ROOM', commands.start);
      else await state.mutate('CALCULATE_OPTIONS', commands.calculate);
    } catch (error) {
      setError(participationError(error));
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  const { participants, completed, incomplete, host, allCompleted, requiredInputs } = model;
  const activeShare =
    shareKind && (shareKind === 'reminder' ? model.canRemind : model.canNotifyHost)
      ? shareKind
      : null;
  const canStart = model.canStart && !busy && !state.loading;
  const canCalculate = model.canCalculate && !busy && !state.loading;
  return (
    <div
      className={`page participation-status${recruitment ? ' room-recruitment' : ''}`}
      data-room-screen={recruitment ? PATHS.recruitment : PATHS.participation}
    >
      <Header title="참여 현황" showBackButton onBack={() => navigate(PATHS.home)} />
      <main className="participation-status__content">
        {recruitment ? (
          <>
            <section className="room-recruitment__intro" aria-labelledby="room-recruitment-title">
              <span className="room-recruitment__icon" aria-hidden="true">
                💌
              </span>
              <h2 id="room-recruitment-title">약속방 인원을 기다리는 중이에요</h2>
              <p>
                {host
                  ? '두 명 이상 참여하면 현재 인원으로 모임을 시작할 수 있어요.'
                  : '방장이 모임을 시작하면 정원이 확정돼요.'}
              </p>
            </section>
            <ParticipantList participants={participants} mode="waiting" />
            <ParticipationSummary
              count={room.joinedCount}
              total={room.capacity}
              label="참여 완료"
              description={
                room.joinedCount >= room.capacity
                  ? '모든 인원이 이 방에 참여했어요!'
                  : `현재 ${room.joinedCount}명이 이 방에 참여했어요!`
              }
            />
          </>
        ) : (
          <>
            <ParticipationSummary
              count={completed}
              total={room.inputProgress.capacity}
              label="입력 완료"
              description={
                allCompleted
                  ? '참여 인원 모두가 입력을 완료했어요!'
                  : completed < requiredInputs
                    ? `최소 ${requiredInputs}명 이상 입력을 완료해야 후보를 계산할 수 있어요.`
                    : incomplete.length
                      ? `${incomplete.map(({ name }) => name).join(', ')} 님이 아직 가능 시간을 입력하지 않았어요`
                      : '참여자의 입력 현황을 확인하세요.'
              }
            />
            <ParticipantList participants={participants} />
            {room.allowedActions.includes('EDIT_INPUT') && (
              <Link to={serverScreenUrl(PATHS.schedule, room.roomId)}>내 일정 입력하기</Link>
            )}
          </>
        )}
        {error && <RequestStatus title="참여 현황 요청을 처리하지 못했어요." description={error} />}
        {state.notice && <p role="status">{state.notice}</p>}
      </main>
      <footer className="participation-status__footer">
        {recruitment ? (
          host && (
            <Button
              className="participation-status__proceed"
              disabled={!canStart}
              onClick={() => setConfirm('start')}
            >
              {busy ? '모임 시작 중…' : '이 인원으로 모임 시작'}
            </Button>
          )
        ) : (
          <>
            {host && (
              <Button
                className="participation-status__proceed"
                disabled={!canCalculate}
                onClick={() => (allCompleted ? void run('calculate') : setConfirm('calculate'))}
              >
                {busy
                  ? '후보 계산 중…'
                  : allCompleted
                    ? '약속 장소 확인하기'
                    : '지금까지 입력한 후보로 진행'}
              </Button>
            )}
            {model.canRemind && (
              <Button onClick={() => setShareKind('reminder')}>입력 재촉하기</Button>
            )}
            {model.canNotifyHost && (
              <Button onClick={() => setShareKind('notifyHost')}>방장에게 알리기</Button>
            )}
          </>
        )}
      </footer>
      <Modal
        open={confirm === 'start' && model.canStart}
        onClose={() => setConfirm(null)}
        className="incomplete-participants-modal"
        aria-labelledby="server-start-title"
      >
        <h2 id="server-start-title">현재 인원으로 모임을 시작할까요?</h2>
        <p>가입을 마감하고 정원을 {room.joinedCount}명으로 확정해요.</p>
        <div className="incomplete-participants-modal__actions">
          <Button variant="secondary" onClick={() => setConfirm(null)}>
            조금 더 기다리기
          </Button>
          <Button disabled={!canStart} onClick={() => void run('start')}>
            모임 시작
          </Button>
        </div>
      </Modal>
      <IncompleteParticipantsModal
        open={confirm === 'calculate' && model.canCalculate && !allCompleted}
        participants={incomplete}
        onClose={() => setConfirm(null)}
        onProceed={() => void run('calculate')}
      />
      {activeShare && (
        <RoomShareDialog
          roomId={room.roomId}
          kind={activeShare === 'reminder' ? 'inputReminder' : 'hostRequest'}
          onClose={() => setShareKind(null)}
        />
      )}
    </div>
  );
}
