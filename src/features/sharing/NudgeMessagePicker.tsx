import { useEffect, useId, useRef, useState } from 'react';
import divider from '../../assets/icons/sharing/message-divider.svg?no-inline';

export default function NudgeMessagePicker({
  options,
  value,
  onChange,
  disabled,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [manual, setManual] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  useEffect(() => {
    if (manual) input.current?.focus();
  }, [manual]);
  return (
    <div className={`nudge-picker${expanded ? ' nudge-picker--expanded' : ''}`}>
      <button
        type="button"
        className="nudge-picker__toggle"
        aria-expanded={expanded}
        aria-controls={id}
        disabled={disabled}
        onClick={() => setExpanded((open) => !open)}
      >
        <span>
          {expanded ? '메시지 접기' : manual ? '직접 입력하기' : value || '메시지 선택하기'}
        </span>
        <span
          className={
            expanded ? 'nudge-picker__arrow nudge-picker__arrow--up' : 'nudge-picker__arrow'
          }
          aria-hidden="true"
        >
          ▼
        </span>
      </button>
      <div id={id} hidden={!expanded}>
        {options.map((option) => (
          <div key={option} className="nudge-picker__option">
            <button
              type="button"
              disabled={disabled}
              aria-pressed={!manual && option === value}
              onClick={() => {
                setManual(false);
                onChange(option);
                setExpanded(false);
              }}
            >
              {option}
            </button>
            <div className="nudge-picker__divider">
              <svg width={246} height={1} viewBox="0 0 246 1" aria-hidden="true">
                <use href={`${divider}#Line 15`} />
              </svg>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="nudge-picker__manual"
          disabled={disabled}
          onClick={() => {
            setManual(true);
            onChange('');
            setExpanded(false);
          }}
        >
          직접 입력하기
        </button>
      </div>
      {manual && (
        <textarea
          ref={input}
          aria-label="친구에게 보낼 메시지"
          placeholder="직접 입력하기"
          maxLength={120}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
        />
      )}
    </div>
  );
}
