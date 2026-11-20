import { useId } from 'react';
import Modal from '../Modal/Modal';
import kakao from '../../../assets/images/login/kakao.svg';
import './LoginRequiredModal.scss';

interface LoginRequiredModalProps {
  open: boolean;
  onClose: () => void;
  onKakaoLogin: () => void;
  dismissible?: boolean;
  busy?: boolean;
  error?: string;
}

export default function LoginRequiredModal({
  open,
  onClose,
  onKakaoLogin,
  dismissible = true,
  busy = false,
  error,
}: LoginRequiredModalProps) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <Modal
      open={open}
      onClose={dismissible ? onClose : () => {}}
      closeOnBackdropClick={dismissible}
      className="login-required-modal"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <div className="login-required-modal__message">
        <h2 id={titleId}>우리 약속 조건을 모으는 중이에요 👀</h2>
        <p id={descriptionId}>먼저 카카오톡으로 로그인해주세요</p>
      </div>
      {error && <p role="alert">{error}</p>}
      <button
        className="login-required-modal__kakao"
        type="button"
        onClick={onKakaoLogin}
        disabled={busy}
        aria-busy={busy}
      >
        <img src={kakao} alt="" draggable={false} />
        {busy ? '카카오로 이동 중…' : '카카오로 로그인하기'}
      </button>
    </Modal>
  );
}
