import RequestStatus from '../../../components/common/RequestStatus/RequestStatus';
import { useId } from 'react';
import Modal from '../../../components/common/Modal/Modal';
import Button from '../../../components/common/Button/Button';

interface AppointmentDeleteModalProps {
  canDelete: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pending?: boolean;
  error?: string;
}

export default function AppointmentDeleteModal({
  canDelete,
  onClose,
  onConfirm,
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
        {canDelete ? '내 목록에서 숨기시겠어요?' : '다가오는 약속은 숨길 수 없어요'}
      </h2>
      <p id={descriptionId}>
        {canDelete
          ? '내 약속 목록에서만 숨겨져요. 다른 참여자의 약속은 유지돼요.'
          : '지난 약속만 숨길 수 있어요.'}
      </p>
      {error && <RequestStatus title="약속을 삭제하지 못했어요." description={error} />}
      <Button disabled={pending} onClick={canDelete ? onConfirm : onClose}>
        {pending ? '처리 중…' : canDelete ? '목록에서 숨기기' : '돌아가기'}
      </Button>
      {canDelete && (
        <Button variant="secondary" disabled={pending} onClick={onClose}>
          취소하기
        </Button>
      )}
    </Modal>
  );
}
