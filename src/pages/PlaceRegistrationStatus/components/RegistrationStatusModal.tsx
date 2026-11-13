import { useId, useState } from 'react';
import Modal from '../../../components/common/Modal/Modal';
import Button from '../../../components/common/Button/Button';
import RegistrationParticipantList from './RegistrationParticipantList';
import { getRegistrationSummary } from '../statusUtils';
import type { RegistrationParticipant } from '../types';
import './RegistrationStatusModal.scss';

interface RegistrationStatusModalProps {
  canManage?: boolean;
  open: boolean;
  waiting: boolean;
  participants: RegistrationParticipant[];
  deadline: number;
  now: number;
  onClose: () => void;
  onNext: () => void;
  onVote: () => void;
  onExtend: (additionalMinutes: number) => void;
}

function RegistrationStatusModal({
  canManage = true,
  open,
  waiting,
  participants,
  deadline,
  now,
  onClose,
  onNext,
  onVote,
  onExtend,
}: RegistrationStatusModalProps) {
  const id = useId();
  const [showExtensionInput, setShowExtensionInput] = useState(false);
  const [extensionMinutes, setExtensionMinutes] = useState('60');
  const summary = getRegistrationSummary(participants, deadline, now);
  const hasNotStarted = participants.some(({ status }) => status === 'notStarted');
  const isWaiting =
    !summary.expired && summary.hasIncomplete && (waiting || summary.phase === 'ongoing');
  const title = summary.expired
    ? '장소 등록 시간이 끝났어요.'
    : summary.allCompleted
      ? '모두 장소 등록을 마쳤어요.'
      : isWaiting
        ? '조금 더 기다릴까요?'
        : `${summary.completed} / ${summary.total}명 등록 완료`;
  const validExtension =
    /^\d+$/.test(extensionMinutes) &&
    Number.isSafeInteger(Number(extensionMinutes)) &&
    Number(extensionMinutes) > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      className={`registration-status-modal${isWaiting ? ' registration-status-modal--waiting' : ''}${summary.phase === 'partial' && !isWaiting ? ' registration-status-modal--partial' : ''}`}
      aria-labelledby={`${id}-title`}
      aria-describedby={isWaiting && hasNotStarted ? `${id}-description` : undefined}
    >
      <h2 id={`${id}-title`}>{title}</h2>
      {isWaiting ? (
        <>
          {hasNotStarted && (
            <p id={`${id}-description`}>아직 장소를 등록하지 않은 친구가 있어요.</p>
          )}
          <button
            type="button"
            disabled={!canManage}
            className="registration-status-modal__hour"
            onClick={() => onExtend(60)}
          >
            + 1시간
          </button>
          {showExtensionInput && (
            <form
              className="registration-status-modal__extension"
              onSubmit={(event) => {
                event.preventDefault();
                if (validExtension) onExtend(Number(extensionMinutes));
              }}
            >
              <label htmlFor={`${id}-minutes`}>추가 시간 (분)</label>
              <input
                id={`${id}-minutes`}
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                required
                value={extensionMinutes}
                onChange={(event) => setExtensionMinutes(event.target.value)}
              />
              <Button type="submit" disabled={!validExtension || !canManage}>
                목 데이터에 적용
              </Button>
            </form>
          )}
          <div className="registration-status-modal__actions">
            <Button
              variant="secondary"
              disabled={!canManage}
              className="registration-status-modal__outline"
              onClick={() => setShowExtensionInput((current) => !current)}
            >
              추가 시간 설정
            </Button>
            <Button disabled={!canManage} onClick={onVote}>
              현재 후보로 진행
            </Button>
          </div>
        </>
      ) : (
        <>
          <RegistrationParticipantList participants={participants} />
          {summary.expired || summary.allCompleted ? (
            <Button disabled={!canManage} onClick={onVote}>
              {summary.expired ? '현재 후보로 투표 시작하기' : '투표 시작하기'}
            </Button>
          ) : (
            <div className="registration-status-modal__actions">
              <Button
                variant="secondary"
                className="registration-status-modal__outline"
                onClick={onClose}
              >
                조금 더 기다리기
              </Button>
              <Button disabled={!canManage} onClick={onNext}>
                다음 단계로 이동
              </Button>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

export default RegistrationStatusModal;
