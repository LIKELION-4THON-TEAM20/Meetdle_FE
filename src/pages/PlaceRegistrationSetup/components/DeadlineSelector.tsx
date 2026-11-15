import { useId, useState } from 'react';
import Modal from '../../../components/common/Modal/Modal';
import Button from '../../../components/common/Button/Button';
import {
  formatDeadline,
  getDeadlineWindow,
  HOUR,
  isValidDeadline,
  toLocalDateTime,
} from '../deadlineUtils';
import type { DeadlineMode } from '../types';

interface DeadlineSelectorProps {
  now: number;
  meetingStartsAt: number;
  deadline: number;
  mode: DeadlineMode;
  onChange: (mode: DeadlineMode, deadline: number) => void;
}

function DeadlineSelector({
  now,
  meetingStartsAt,
  deadline,
  mode,
  onChange,
}: DeadlineSelectorProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const window = getDeadlineWindow(now, meetingStartsAt);
  // Native datetime-local inputs use whole minutes: round the valid range inward.
  const minimum = Math.ceil(window.minimum / 60000) * 60000;
  const maximum = Math.floor(window.maximum / 60000) * 60000;
  const customDisabled = !window.canOpen || minimum > maximum;
  const draftTimestamp = new Date(draft).getTime();
  const validDraft = draft !== '' && isValidDeadline(draftTimestamp, now, meetingStartsAt);
  const invalidPreset = !isValidDeadline(now + 3 * HOUR, now, meetingStartsAt);
  const openCustom = () => {
    if (customDisabled) return;
    const initial = Math.max(minimum, Math.min(maximum, Math.ceil(deadline / 60000) * 60000));
    setDraft(toLocalDateTime(initial));
    setOpen(true);
  };

  return (
    <section
      className={`setup-deadline${window.under24Hours ? ' setup-deadline--limited' : ''}`}
      aria-labelledby={`${id}-title`}
    >
      {window.under24Hours && (
        <p className="registration-setup__banner">
          약속까지 24시간 미만이에요. 등록 마감 시간 설정 범위가 제한돼요.
        </p>
      )}
      <h3 id={`${id}-title`}>장소 등록 마감</h3>
      <button
        className="setup-deadline__field"
        type="button"
        onClick={openCustom}
        disabled={customDisabled}
        aria-label={`등록 마감 직접 설정: ${formatDeadline(deadline, now)}`}
        aria-haspopup="dialog"
      >
        <span>{formatDeadline(deadline, now)}</span>
        <span aria-hidden="true">▾</span>
      </button>
      <div className="setup-deadline__presets">
        {(
          [
            { mode: 'oneHour', hours: 1 },
            { mode: 'threeHours', hours: 3 },
          ] as const
        ).map((preset) => (
          <button
            type="button"
            className="setup-chip"
            key={preset.mode}
            aria-pressed={mode === preset.mode}
            disabled={!isValidDeadline(now + preset.hours * HOUR, now, meetingStartsAt)}
            onClick={() => onChange(preset.mode, now + preset.hours * HOUR)}
          >
            {preset.hours}시간 뒤
          </button>
        ))}
        <button
          type="button"
          className="setup-chip setup-chip--custom"
          aria-pressed={mode === 'custom'}
          disabled={customDisabled}
          onClick={openCustom}
        >
          직접 설정
        </button>
      </div>
      <p className="registration-setup__help">
        최소 1시간 이상 열어둬야 해요. 약속 시작 3시간 전에는 등록이 끝나야 해요.
      </p>
      {invalidPreset && (
        <p className="registration-setup__warning">
          이 프리셋은 약속 시작 3시간 전 마감 규칙과 맞지 않아 선택할 수 없어요.
        </p>
      )}
      {!isValidDeadline(deadline, now, meetingStartsAt) && (
        <p className="registration-setup__warning" role="status">
          사용 가능한 범위에서 마감 일시를 다시 선택해주세요.
        </p>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        className="setup-deadline-modal"
        aria-labelledby={`${id}-modal-title`}
      >
        <h2 id={`${id}-modal-title`}>장소 등록 마감</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (validDraft) {
              onChange('custom', draftTimestamp);
              setOpen(false);
            }
          }}
        >
          <label htmlFor={`${id}-input`}>마감 일시</label>
          <input
            id={`${id}-input`}
            type="datetime-local"
            step={60}
            required
            min={toLocalDateTime(minimum)}
            max={toLocalDateTime(maximum)}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-invalid={!validDraft}
            aria-describedby={`${id}-range`}
          />
          <p id={`${id}-range`} className="registration-setup__help">
            {formatDeadline(minimum, now)} ~ {formatDeadline(maximum, now)}
          </p>
          <Button type="submit" disabled={!validDraft}>
            확인
          </Button>
        </form>
      </Modal>
    </section>
  );
}

export default DeadlineSelector;
