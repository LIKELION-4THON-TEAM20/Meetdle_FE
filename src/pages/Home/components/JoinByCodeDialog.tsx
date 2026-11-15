import { useRef, useState } from 'react';
import Button from '../../../components/common/Button/Button';
import { trapDialogFocus, useModalDialog } from '../../../hooks/useModalDialog';
import RoomFullNotice from './RoomFullNotice';
import type { JoinByCodeHandler } from '../join-code.types';
import './JoinByCodeDialog.scss';

interface JoinByCodeDialogProps {
  onClose: () => void;
  // API 연결 시 코드 확인/입장을 담당한다. 실패는 호출부에서 오류로 전달한다.
  onSubmitCode?: JoinByCodeHandler;
}

function JoinByCodeDialog({ onClose, onSubmitCode }: JoinByCodeDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [code, setCode] = useState('');
  const [fullCapacity, setFullCapacity] = useState<number | null>(null);
  const isRoomFull = fullCapacity !== null;
  const dismiss = () => {
    if (isRoomFull) setFullCapacity(null);
    else onClose();
  };
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isCodeComplete = /^[A-Z0-9]{6}$/.test(code);
  const formatError = touched && code.length > 0 && !isCodeComplete;
  const errorMessage = error || (formatError ? '유효하지 않은 초대 코드예요.' : '');
  useModalDialog(dialogRef);

  return (
    <dialog
      ref={dialogRef}
      className={`join-code-dialog${errorMessage ? ' join-code-dialog--error' : ''}${isRoomFull ? ' join-code-dialog--room-full' : ''}`}
      role={isRoomFull ? 'alertdialog' : 'dialog'}
      aria-labelledby={isRoomFull ? 'room-full-title' : 'join-code-title'}
      aria-describedby={isRoomFull ? 'room-full-description' : 'join-code-description'}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        dismiss();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        trapDialogFocus(event);
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          dismiss();
      }}
    >
      {isRoomFull ? (
        <RoomFullNotice capacity={fullCapacity} onConfirm={() => setFullCapacity(null)} />
      ) : (
        <form
          className="join-code-dialog__form"
          noValidate
          onSubmit={async (event) => {
            event.preventDefault();
            setTouched(true);
            if (!isCodeComplete || isSubmitting) return;
            if (!onSubmitCode) {
              setNotice('아직 초대 코드 확인 기능이 연결되지 않았어요.');
              return;
            }
            setIsSubmitting(true);
            try {
              const result = await onSubmitCode(code);
              if (result === 'invalid-code') setError('유효하지 않은 초대 코드예요.');
              else if (result?.status === 'room-full') setFullCapacity(result.capacity);
            } catch {
              setError('초대 코드를 확인하지 못했어요. 다시 시도해주세요.');
            } finally {
              setIsSubmitting(false);
            }
          }}
        >
          <h2 id="join-code-title">초대 코드로 입장하기</h2>
          <p id="join-code-description">친구에게 받은 초대 코드를 입력해주세요.</p>
          <input
            className="join-code-dialog__input"
            aria-label="초대 코드"
            aria-invalid={!!errorMessage}
            aria-describedby={errorMessage ? 'join-code-error' : 'join-code-description'}
            placeholder="예)6F3K9Q"
            value={code}
            onChange={(event) => {
              setCode(event.target.value.trim().toUpperCase());
              setError('');
              setNotice('');
            }}
            onBlur={() => setTouched(true)}
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={6}
            readOnly={isSubmitting}
          />
          {errorMessage && (
            <p className="join-code-dialog__error" id="join-code-error" role="alert">
              {errorMessage}
            </p>
          )}
          {notice && (
            <p className="join-code-dialog__notice" role="status">
              {notice}
            </p>
          )}
          <Button
            type="submit"
            disabled={!isCodeComplete || !!error || isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? '확인 중...' : '약속방 들어가기'}
          </Button>
        </form>
      )}
    </dialog>
  );
}

export default JoinByCodeDialog;
