import { useId, type ReactNode } from 'react';
import Button from '../../../components/common/Button/Button';
import Modal from '../../../components/common/Modal/Modal';

const COPY = {
  reminder: {
    title: '입력 안 한 친구 재촉하기',
    description: '가능한 시간과 출발역만 입력하면 끝!',
  },
  notifyHost: {
    title: '방장에게 알리기',
    description: '우리 이제 다음 단계로 넘어가자고 알려요',
  },
  result: {
    title: '최종 일정 공유하기',
    description: '공유 문구와 대상을 확인해주세요.',
  },
};

interface ParticipationShareModalProps {
  kind: keyof typeof COPY | null;
  onClose: () => void;
  copy?: { title: string; description: string };
  children?: ReactNode;
  onSend?: () => void;
  disabled?: boolean;
  className?: string;
}

function ParticipationShareModal({
  kind,
  onClose,
  copy,
  children,
  onSend,
  disabled,
  className,
}: ParticipationShareModalProps) {
  const id = useId();
  if (!kind) return null;
  const { title, description } = copy ?? COPY[kind];

  return (
    <Modal
      open
      onClose={onClose}
      closeOnBackdropClick={false}
      closeOnEscape={false}
      className={className ? `participation-share-modal ${className}` : 'participation-share-modal'}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
    >
      <div className="participation-share-modal__copy">
        <h2 id={`${id}-title`}>{title}</h2>
        <p id={`${id}-description`}>{description}</p>
      </div>
      {children}
      <Button
        className="participation-share-modal__send"
        disabled={disabled}
        onClick={onSend ?? (() => window.alert('카카오톡 공유 SDK는 아직 연동되지 않았어요.'))}
      >
        카카오톡으로 전송하기
      </Button>
    </Modal>
  );
}

export default ParticipationShareModal;
