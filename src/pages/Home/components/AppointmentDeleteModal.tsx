import { useId } from 'react';
import Modal from '../../../components/common/Modal/Modal';
import Button from '../../../components/common/Button/Button';

interface AppointmentDeleteModalProps {
  canDelete: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function AppointmentDeleteModal({
  canDelete,
  onClose,
  onConfirm,
}: AppointmentDeleteModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  return (
    <Modal
      open
      onClose={onClose}
      className={`appointment-delete-modal${canDelete ? '' : ' appointment-delete-modal--notice'}`}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <h2 id={titleId}>
        {canDelete ? '정말로 삭제하시겠어요?' : '다가오는 약속은 삭제가 불가능해요'}
      </h2>
      <p id={descriptionId}>
        {canDelete ? '이 약속에 대한 정보는 전부 삭제됩니다.' : '지난 약속만 삭제가 가능해요'}
      </p>
      <Button onClick={canDelete ? onConfirm : onClose}>
        {canDelete ? '삭제하기' : '돌아가기'}
      </Button>
      {canDelete && (
        <Button variant="secondary" onClick={onClose}>
          취소하기
        </Button>
      )}
    </Modal>
  );
}
