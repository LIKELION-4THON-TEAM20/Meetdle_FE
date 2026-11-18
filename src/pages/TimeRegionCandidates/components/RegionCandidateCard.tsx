import { useId } from 'react';
import type { RegionCandidate } from '../types';

interface RegionCandidateCardProps {
  candidate: RegionCandidate;
  groupName: string;
  selected: boolean;
  expanded: boolean;
  showDetails?: boolean;
  onSelect: () => void;
  onToggleDetails: () => void;
}

function RegionCandidateCard({
  candidate,
  groupName,
  selected,
  expanded,
  showDetails = true,
  onSelect,
  onToggleDetails,
}: RegionCandidateCardProps) {
  const detailsId = useId();
  return (
    <article className="region-candidate">
      <label className="candidate-card">
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
              <span className="candidate-card__name">{candidate.stationName}</span>
              <span className="candidate-card__subtitle">
                지하철 {candidate.subwayLines.join('·')}호선
              </span>
            </span>
            <span className="candidate-card__radio" aria-hidden="true" />
          </span>
          <span
            className={`candidate-card__badge${candidate.recommended ? ' candidate-card__badge--recommended' : ''}`}
          >
            {candidate.recommendationLabel}
          </span>
          <span className="candidate-card__description">
            평균 {candidate.averageTravelMinutes}분 · 최대 {candidate.maximumTravelMinutes}분 · 환승{' '}
            {candidate.averageTransfers}회
          </span>
        </span>
      </label>
      {showDetails && candidate.participantTravels.length > 0 && (
        <>
          <button
            className="region-candidate__toggle"
            type="button"
            aria-expanded={expanded}
            aria-controls={detailsId}
            aria-label={`${candidate.stationName} 이동시간 상세 ${expanded ? '접기' : '펼치기'}`}
            onClick={onToggleDetails}
          >
            이동시간 상세 <span aria-hidden="true">{expanded ? '⌃' : '⌄'}</span>
          </button>
          <section
            id={detailsId}
            className="region-candidate__details"
            hidden={!expanded}
            aria-label={`${candidate.stationName} 이동시간 상세`}
          >
            <h4>{candidate.stationName} · 이동시간 상세</h4>
            <ul>
              {candidate.participantTravels.map((travel) => (
                <li key={travel.participantId}>
                  <span>{travel.name}</span>
                  <span className="region-candidate__travel">
                    <span>
                      {travel.transportLabel} {travel.minutes}분
                    </span>
                    <span className="region-candidate__transfers">환승 {travel.transfers}회</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </article>
  );
}

export default RegionCandidateCard;
