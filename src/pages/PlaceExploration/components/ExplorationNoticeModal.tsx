import { useId } from 'react';
import Modal from '../../../components/common/Modal/Modal';
import Button from '../../../components/common/Button/Button';

interface ExplorationNoticeModalProps {
  title: string;
  description: string;
  actionLabel: string;
  onClose: () => void;
  onAction?: () => void;
}

export default function ExplorationNoticeModal({
  title,
  description,
  actionLabel,
  onClose,
  onAction,
}: ExplorationNoticeModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  return (
    <Modal
      open
      onClose={onClose}
      className="exploration-notice-modal"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <h2 id={titleId}>{title}</h2>
      <p id={descriptionId}>{description}</p>
      <Button onClick={onAction ?? onClose}>{actionLabel}</Button>
    </Modal>
  );
}
