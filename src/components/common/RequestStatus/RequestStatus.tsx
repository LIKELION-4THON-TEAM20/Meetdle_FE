import { useId } from 'react';
import type { ReactNode } from 'react';
import './RequestStatus.scss';

export default function RequestStatus({
  title,
  description,
  loading = false,
  onRetry,
  retryLabel = '다시 시도',
  disabled = false,
  children,
}: {
  title: string;
  description?: string;
  loading?: boolean;
  onRetry?: () => void;
  retryLabel?: string;
  disabled?: boolean;
  children?: ReactNode;
}) {
  const id = useId();
  return (
    <section
      className={`request-status${loading ? ' request-status--loading' : ''}`}
      role={loading ? 'status' : 'alert'}
      aria-labelledby={id}
      aria-busy={loading}
    >
      <span className="request-status__icon" aria-hidden="true">
        {loading ? (
          <span className="request-status__spinner" />
        ) : (
          <svg viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="17" />
            <path d="M20 10v12" />
            <circle cx="20" cy="29" r="1" />
          </svg>
        )}
      </span>
      <h2 id={id}>{title}</h2>
      {description && <p>{description}</p>}
      {(onRetry || children) && (
        <div className="request-status__actions">
          {onRetry && (
            <button type="button" onClick={onRetry} disabled={disabled || loading}>
              {retryLabel}
            </button>
          )}
          {children}
        </div>
      )}
    </section>
  );
}

export function RequestStatusPage({
  children,
  footer,
}: {
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="page request-status-page">
      <div className="request-status-page__content">{children}</div>
      {footer && <footer className="request-status-page__footer">{footer}</footer>}
    </main>
  );
}
