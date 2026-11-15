import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './Modal.scss';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  closeOnBackdropClick?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

let scrollLockCount = 0;
let previousOverflow = '';

function Modal({
  open,
  onClose,
  children,
  closeOnBackdropClick = true,
  className = '',
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const backdropPointerDown = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;

    const previousFocus = document.activeElement;

    // Native modal dialogs provide focus containment and make the background inert.
    dialog.showModal();
    if (scrollLockCount === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    scrollLockCount += 1;

    return () => {
      dialog.close();
      backdropPointerDown.current = false;
      scrollLockCount -= 1;
      if (scrollLockCount === 0) {
        document.body.style.overflow = previousOverflow;
      }
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      className="common-modal"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabelledBy ? undefined : (ariaLabel ?? '알림')}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onPointerDown={(event) => {
        backdropPointerDown.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (
          closeOnBackdropClick &&
          backdropPointerDown.current &&
          event.target === event.currentTarget
        ) {
          onClose();
        }
        backdropPointerDown.current = false;
      }}
    >
      <div className={`common-modal__panel${className ? ` ${className}` : ''}`} tabIndex={-1}>
        {children}
      </div>
    </dialog>,
    document.body,
  );
}

export default Modal;
