import { useId } from 'react';
import Modal from '../../../components/common/Modal/Modal';
import Button from '../../../components/common/Button/Button';
import type { RegistrationParticipant, RegistrationPhase } from '../types';
import RegistrationParticipantList from './RegistrationParticipantList';
import './RegistrationStatusModal.scss';

interface Props {
  phase: RegistrationPhase;
  participants: RegistrationParticipant[];
  completed: number;
  onClose: () => void;
  onProceed: () => void;
  onExtend: () => void;
}

export default function RegistrationStatusModal({
  phase,
  participants,
  completed,
  onClose,
  onProceed,
  onExtend,
}: Props) {
  const id = useId();
  const expired = phase === 'expired';
  const allCompleted = phase === 'allCompleted';
  const title = expired
    ? '장소 등록 시간이 끝났어요.'
    : allCompleted
      ? '모두 장소 등록을 마쳤어요.'
      : `${completed} / ${participants.length}명 등록 완료`;

  return (
    <Modal open onClose={onClose} className="registration-status-modal" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <RegistrationParticipantList participants={participants} />
      <Button onClick={onProceed}>
        {expired ? '현재 후보로 투표 시작하기' : allCompleted ? '다음 단계' : '다음 단계로 이동'}
      </Button>
      {expired && (
        <Button className="registration-secondary" onClick={onExtend}>
          등록 마감시간 연장하기
        </Button>
      )}
      {phase === 'partial' && (
        <Button className="registration-status-modal__outline" onClick={onClose}>
          조금 더 기다리기
        </Button>
      )}
    </Modal>
  );
}
