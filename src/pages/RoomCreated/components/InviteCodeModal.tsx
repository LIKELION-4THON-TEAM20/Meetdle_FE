import { useId } from 'react';
import Modal from '../../../components/common/Modal/Modal';
import Button from '../../../components/common/Button/Button';
import './InviteCodeModal.scss';

interface InviteCodeModalProps {
  open: boolean;
  onClose: () => void;
  code: string;
  onCodeChange: (code: string) => void;
  onSubmit: (code: string) => void;
  error?: boolean;
}

function InviteCodeModal({
  open,
  onClose,
  code,
  onCodeChange,
  onSubmit,
  error = false,
}: InviteCodeModalProps) {
  const id = useId();
  return (
    <Modal
      open={open}
      onClose={onClose}
      className={`invite-code-modal${error ? ' invite-code-modal--error' : ''}`}
      aria-labelledby={`${id}-title`}
      aria-describedby={error ? `${id}-error` : `${id}-help`}
    >
      <h2 id={`${id}-title`}>초대 코드로 입장하기</h2>
      {!error && (
        <p className="invite-code-modal__help" id={`${id}-help`}>
          친구에게 받은 초대 코드를 입력해주세요.
        </p>
      )}
      <form
        className="invite-code-modal__form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!error && /^[A-Z0-9]+$/i.test(code)) onSubmit(code);
        }}
      >
        <input
          className="invite-code-modal__input"
          aria-label="초대 코드"
          aria-invalid={error}
          aria-describedby={error ? `${id}-error` : `${id}-help`}
          value={code}
          onChange={(event) =>
            onCodeChange(event.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase())
          }
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          required
          pattern="[A-Za-z0-9]+"
        />
        {error && (
          <p className="invite-code-modal__error" id={`${id}-error`} role="alert">
            유효하지 않은 초대 코드예요.
          </p>
        )}
        <Button
          type="submit"
          className="invite-code-modal__submit"
          disabled={error || !/^[A-Z0-9]+$/i.test(code)}
        >
          약속방 들어가기
        </Button>
      </form>
    </Modal>
  );
}

export default InviteCodeModal;
