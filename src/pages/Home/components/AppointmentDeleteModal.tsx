import { useId } from 'react';
import Modal from '../../../components/common/Modal/Modal';
import Button from '../../../components/common/Button/Button';

interface AppointmentDeleteModalProps {
  canDelete: boolean;
  onClose: () => void;
  onConfirm: () => void;
  serverHide?: boolean;
  pending?: boolean;
  error?: string;
}

export default function AppointmentDeleteModal({
  canDelete,
  onClose,
  onConfirm,
  serverHide = false,
  pending = false,
  error,
}: AppointmentDeleteModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  return (
    <Modal
      open
      onClose={() => {
        if (!pending) onClose();
      }}
      className={`appointment-delete-modal${canDelete ? '' : ' appointment-delete-modal--notice'}`}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <h2 id={titleId}>
        {canDelete
          ? serverHide
            ? '내 목록에서 숨기시겠어요?'
            : '정말로 삭제하시겠어요?'
          : serverHide
            ? '다가오는 약속은 숨길 수 없어요'
            : '다가오는 약속은 삭제가 불가능해요'}
      </h2>
      <p id={descriptionId}>
        {canDelete
          ? serverHide
            ? '내 약속 목록에서만 숨겨져요. 다른 참여자의 약속은 유지돼요.'
            : '이 약속에 대한 정보는 전부 삭제됩니다.'
          : '지난 약속만 삭제가 가능해요'}
      </p>
      {error && <p role="alert">{error}</p>}
      <Button disabled={pending} onClick={canDelete ? onConfirm : onClose}>
        {pending
          ? '처리 중…'
          : canDelete
            ? serverHide
              ? '목록에서 숨기기'
              : '삭제하기'
            : '돌아가기'}
      </Button>
      {canDelete && (
        <Button variant="secondary" disabled={pending} onClick={onClose}>
          취소하기
        </Button>
      )}
    </Modal>
  );
}
