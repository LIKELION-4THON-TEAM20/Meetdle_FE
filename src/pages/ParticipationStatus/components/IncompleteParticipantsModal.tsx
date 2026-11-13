import { useId } from 'react';
import Modal from '../../../components/common/Modal/Modal';
import Button from '../../../components/common/Button/Button';
import type { Participant } from '../types';
import './IncompleteParticipantsModal.scss';

interface IncompleteParticipantsModalProps {
  open: boolean;
  participants: Participant[];
  onClose: () => void;
  onProceed: () => void;
}

function IncompleteParticipantsModal({
  open,
  participants,
  onClose,
  onProceed,
}: IncompleteParticipantsModalProps) {
  const id = useId();
  const names = participants.map(({ name }) => `${name}님`).join(', ');

  return (
    <Modal
      open={open}
      onClose={onClose}
      className="incomplete-participants-modal"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
    >
      <h2 id={`${id}-title`}>아직 입력하지 않은 친구가 있어요.</h2>
      <p id={`${id}-description`}>{names}은 이번 후보 계산에서 제외됩니다.</p>
      <div className="incomplete-participants-modal__actions">
        <Button
          variant="secondary"
          className="incomplete-participants-modal__wait"
          onClick={onClose}
        >
          조금 더 기다리기
        </Button>
        <Button onClick={onProceed}>현재 인원으로 진행</Button>
      </div>
    </Modal>
  );
}

export default IncompleteParticipantsModal;
