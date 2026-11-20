import { useCallback, useId, useRef, useState } from 'react';
import copyIcon from '../../../assets/icons/room-created/copy.svg';
import Button from '../../../components/common/Button/Button';
import Modal from '../../../components/common/Modal/Modal';
import Toast, { type ToastMessage } from '../../../components/common/Toast/Toast';
import './InviteCodeCopy.scss';

interface InviteCodeCopyProps {
  code: string;
  onShare: () => void;
}

function InviteCodeCopy({ code, onShare }: InviteCodeCopyProps) {
  const id = useId();
  const [showCopiedModal, setShowCopiedModal] = useState(false);
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const copying = useRef(false);
  const dismiss = useCallback(() => setMessage(null), []);

  const copyCode = async () => {
    if (copying.current) return;

    copying.current = true;
    try {
      await navigator.clipboard.writeText(code);
      setMessage(null);
      setShowCopiedModal(true);
    } catch {
      setMessage({
        tone: 'error',
        title: '초대 코드를 복사하지 못했어요.',
        description: '브라우저의 클립보드 권한을 확인해주세요.',
      });
    } finally {
      copying.current = false;
    }
  };

  return (
    <section className="invite-code-copy" aria-label="초대 코드">
      <span className="invite-code-copy__label">초대 코드</span>
      <span className="invite-code-copy__code">{code}</span>
      <button
        className="invite-code-copy__button"
        type="button"
        onClick={copyCode}
        aria-label="초대 코드 복사"
      >
        복사
      </button>
      <Toast message={message} onDismiss={dismiss} icon={<img src={copyIcon} alt="" />} />
      <Modal
        open={showCopiedModal}
        onClose={() => setShowCopiedModal(false)}
        closeOnBackdropClick={false}
        className="invite-code-copied-modal"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
      >
        <h2 id={`${id}-title`} className="invite-code-copied-modal__title">
          <span className="invite-code-copied-modal__icon">
            <img src={copyIcon} alt="" />
          </span>
          초대코드가 복사 되었어요
        </h2>
        <p id={`${id}-description`} className="invite-code-copied-modal__description">
          친구들에게 공유해보세요!
        </p>
        <Button className="invite-code-copied-modal__action" onClick={onShare}>
          카카오톡으로 전송하기
        </Button>
        <Button
          className="invite-code-copied-modal__action invite-code-copied-modal__action--confirm"
          onClick={() => setShowCopiedModal(false)}
        >
          확인
        </Button>
      </Modal>
    </section>
  );
}

export default InviteCodeCopy;
