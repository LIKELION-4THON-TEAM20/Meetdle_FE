import type { JoinByCodeHandler } from '../join-code.types';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { trapDialogFocus, useModalDialog } from '../../../hooks/useModalDialog';
import JoinByCodeDialog from './JoinByCodeDialog';
import close from '../../../assets/icons/home/close.svg';
import chevron from '../../../assets/icons/home/sheet-chevron.svg';
import joinChevron from '../../../assets/icons/home/sheet-join-chevron.svg';
import { PATHS } from '../../../router/paths';

interface AddAppointmentSheetProps {
  onClose: () => void;
  onSubmitCode?: JoinByCodeHandler;
}

function AddAppointmentSheet({ onClose, onSubmitCode }: AddAppointmentSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [isJoinOpen, setIsJoinOpen] = useState(false);
  useModalDialog(dialogRef);

  return (
    <dialog
      ref={dialogRef}
      className="add-appointment-sheet"
      aria-labelledby="add-appointment-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={trapDialogFocus}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
    >
      <header className="add-appointment-sheet__header">
        <h2 id="add-appointment-title">약속 추가하기</h2>
        <button type="button" aria-label="닫기" onClick={onClose} autoFocus>
          <img src={close} alt="" draggable={false} />
        </button>
      </header>
      <Link className="add-appointment-sheet__action" to={PATHS.create} onClick={onClose}>
        새 약속 만들기
        <img src={chevron} alt="" draggable={false} />
      </Link>
      <button
        className="add-appointment-sheet__action"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isJoinOpen}
        onClick={() => setIsJoinOpen(true)}
      >
        코드로 참여하기
        <img src={joinChevron} alt="" draggable={false} />
      </button>
      {isJoinOpen && (
        <JoinByCodeDialog onClose={() => setIsJoinOpen(false)} onSubmitCode={onSubmitCode} />
      )}
    </dialog>
  );
}

export default AddAppointmentSheet;
