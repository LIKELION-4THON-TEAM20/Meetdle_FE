import { useId } from 'react';
import Modal from '../../../components/common/Modal/Modal';
import Button from '../../../components/common/Button/Button';
import './RoomFullModal.scss';

interface RoomFullModalProps {
  open: boolean;
  onClose: () => void;
}

function RoomFullModal({ open, onClose }: RoomFullModalProps) {
  const id = useId();
  return (
    <Modal
      open={open}
      onClose={onClose}
      className="room-full-modal"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
    >
      <h2 id={`${id}-title`}>방이 가득 찼어요.</h2>
      <p id={`${id}-description`}>이 약속방은 정원 6명이 모두 참여했어요.</p>
      <Button className="room-full-modal__confirm" onClick={onClose}>
        확인
      </Button>
    </Modal>
  );
}

export default RoomFullModal;
