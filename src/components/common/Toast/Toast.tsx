import { useEffect, type ReactNode } from 'react';
import './Toast.scss';

export interface ToastMessage {
  tone: 'success' | 'error';
  title: string;
  description?: string;
}

interface ToastProps {
  message: ToastMessage | null;
  onDismiss: () => void;
  icon?: ReactNode;
  durationMs?: number;
}

function Toast({ message, onDismiss, icon, durationMs = 2500 }: ToastProps) {
  useEffect(() => {
    if (!message) return;

    const timer = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss, durationMs]);

  return (
    <div className={message ? 'common-toast common-toast--visible' : 'common-toast'}>
      {(['success', 'error'] as const).map((tone) => (
        <div key={tone} role={tone === 'success' ? 'status' : 'alert'} aria-atomic="true">
          {message?.tone === tone && (
            <div className="common-toast__panel">
              <p className="common-toast__title">
                {icon && <span aria-hidden="true">{icon}</span>}
                {message.title}
              </p>
              {message.description && (
                <p className="common-toast__description">{message.description}</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default Toast;
