import { useId } from 'react';
import Button from '../../../components/common/Button/Button';
import Modal from '../../../components/common/Modal/Modal';
import VoteParticipantList from './VoteParticipantList';
import type { VoteParticipant } from '../types';

interface Props {
  final: boolean;
  participants: VoteParticipant[];
  completed: number;
  confirmDisabled?: boolean;
  unavailableReason?: string;
  onClose: () => void;
  onConfirm: () => void;
}

export default function VoteCloseModal({
  final,
  participants,
  completed,
  confirmDisabled,
  unavailableReason,
  onClose,
  onConfirm,
}: Props) {
  const id = useId();
  const pending = participants.filter(({ completed }) => !completed);
  return (
    <Modal
      open
      onClose={onClose}
      closeOnBackdropClick={false}
      closeOnEscape={false}
      className={`vote-close-modal${final ? ' vote-close-modal--final' : ''}`}
      aria-labelledby={id}
    >
      <h2 id={id}>
        {final
          ? '정말 투표를 마무리 하시겠어요?'
          : `${completed} / ${participants.length}명 투표 완료`}
      </h2>
      {final && (
        <p>{pending.map(({ name }) => name).join(', ')}님의 의견은 결과에 반영되지 않아요.</p>
      )}
      <VoteParticipantList
        participants={final ? pending : participants.filter((p) => p.completed)}
      />
      {unavailableReason && <p role="status">{unavailableReason}</p>}
      <div className="vote-close-modal__actions">
        <Button className="vote-close-modal__wait" onClick={onClose}>
          마감까지 기다리기
        </Button>
        <Button disabled={confirmDisabled} onClick={onConfirm}>
          {final ? '투표 마감하기' : '다음 단계로 이동'}
        </Button>
      </div>
    </Modal>
  );
}
