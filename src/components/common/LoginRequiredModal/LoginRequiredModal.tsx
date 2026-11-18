import { useId } from 'react';
import Modal from '../Modal/Modal';
import kakao from '../../../assets/images/login/kakao.svg';
import './LoginRequiredModal.scss';

interface LoginRequiredModalProps {
  open: boolean;
  onClose: () => void;
  onKakaoLogin: () => void;
}

export default function LoginRequiredModal({
  open,
  onClose,
  onKakaoLogin,
}: LoginRequiredModalProps) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <Modal
      open={open}
      onClose={onClose}
      className="login-required-modal"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <div className="login-required-modal__message">
        <h2 id={titleId}>우리 약속 조건을 모으는 중이에요 👀</h2>
        <p id={descriptionId}>먼저 카카오톡으로 로그인해주세요</p>
      </div>
      <button className="login-required-modal__kakao" type="button" onClick={onKakaoLogin}>
        <img src={kakao} alt="" draggable={false} />
        카카오로 로그인하기
      </button>
    </Modal>
  );
}
