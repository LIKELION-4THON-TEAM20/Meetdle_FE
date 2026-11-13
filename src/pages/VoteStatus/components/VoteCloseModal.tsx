import Button from '../../../components/common/Button/Button';
import Modal from '../../../components/common/Modal/Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function VoteCloseModal({ open, onClose, onConfirm }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      className="vote-close-modal"
      aria-labelledby="vote-close-title"
      aria-describedby="vote-close-description"
    >
      <h2 id="vote-close-title">투표 참여가 부족해요</h2>
      <p id="vote-close-description">마감까지 더 기다리면 더 많은 의견을 반영할 수 있어요.</p>
      <div className="vote-close-modal__actions">
        <Button className="vote-close-modal__wait" onClick={onClose}>
          조금 더 기다리기
        </Button>
        <Button onClick={onConfirm}>지금 마감하기</Button>
      </div>
    </Modal>
  );
}
