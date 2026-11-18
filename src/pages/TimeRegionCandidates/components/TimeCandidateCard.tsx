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
        <span className="candidate-card__row">
          <span className="candidate-card__stack">
            <span className="candidate-card__name">{formatCandidateDate(candidate.date)}</span>
            <span className="candidate-card__subtitle">
              {candidate.startTime} - {candidate.endTime}
            </span>
          </span>
          <span className="candidate-card__radio" aria-hidden="true" />
        </span>
        <span
          className={`candidate-card__badge${candidate.recommended ? ' candidate-card__badge--recommended' : ''}`}
        >
          {candidate.recommended
            ? '추천'
            : `${candidate.availableCount} / ${candidate.totalCount}명 가능`}
        </span>
        {(candidate.averageWaitMinutes !== undefined || allAvailable) && (
          <span className="candidate-card__description">
            {candidate.averageWaitMinutes !== undefined &&
              `평균 대기 ${candidate.averageWaitMinutes}분`}
            {candidate.averageWaitMinutes !== undefined && allAvailable && ' · '}
            {allAvailable && '전원 참여 가능'}
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
