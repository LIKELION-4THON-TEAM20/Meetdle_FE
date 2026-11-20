interface Props {
  message: string;
  warning?: boolean;
  onRetry?: () => void;
  disabled?: boolean;
}

export default function ExplorationSearchNotice({ message, warning, onRetry, disabled }: Props) {
  return (
    <div className="exploration-search-notice" role="status">
      {warning && <span className="exploration-search-notice__icon" aria-hidden="true">!</span>}
      <p>{message}</p>
      {onRetry && (
        <button type="button" disabled={disabled} onClick={onRetry}>다시 시도</button>
      )}
    </div>
  );
}
