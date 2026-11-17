import { formatCandidateDate } from '../candidateUtils';
import type { TimeCandidate } from '../types';

interface TimeCandidateCardProps {
  candidate: TimeCandidate;
  groupName: string;
  selected: boolean;
  onSelect: () => void;
}

function TimeCandidateCard({ candidate, groupName, selected, onSelect }: TimeCandidateCardProps) {
  const allAvailable = candidate.allParticipantsAvailable;
  return (
    <label className={`candidate-card${allAvailable ? ' candidate-card--all-available' : ''}`}>
      <input
        className="candidate-card__input"
        type="radio"
        name={groupName}
        value={candidate.id}
        checked={selected}
        onChange={onSelect}
      />
      <span className="candidate-card__surface">
        {allAvailable && <span className="candidate-card__all-badge">모두 가능한 시간이에요</span>}
        <span className="candidate-card__row">
          <span className="candidate-card__stack">
            <span
              className={`candidate-card__name${allAvailable ? ' candidate-card__name--compact' : ''}`}
            >
              {formatCandidateDate(candidate.date, allAvailable)}
              {allAvailable && ` ${candidate.startTime}–${candidate.endTime}`}
            </span>
            {!allAvailable && (
              <span className="candidate-card__subtitle">
                {candidate.startTime} - {candidate.endTime}
              </span>
            )}
          </span>
          <span className="candidate-card__radio" aria-hidden="true" />
        </span>
        <span className={allAvailable ? 'candidate-card__all-count' : 'candidate-card__badge'}>
          {allAvailable
            ? `참여자 ${candidate.availableCount} / ${candidate.totalCount}명 전원 가능`
            : `${candidate.availableCount} / ${candidate.totalCount}명 가능`}
        </span>
        {candidate.recommended && !allAvailable && (
          <span className="candidate-card__badge candidate-card__badge--recommended">추천</span>
        )}
        {candidate.averageWaitMinutes !== undefined && !allAvailable && (
          <span className="candidate-card__description">
            평균 대기 {candidate.averageWaitMinutes}분
          </span>
        )}
        {candidate.unavailableParticipantNames.length > 0 && (
          <span className="candidate-card__description">
            {candidate.unavailableParticipantNames.join(', ')}는 이 시간에 참여하기 어려워요
          </span>
        )}
      </span>
    </label>
  );
}

export default TimeCandidateCard;
