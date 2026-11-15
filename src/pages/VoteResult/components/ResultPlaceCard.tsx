import Button from '../../../components/common/Button/Button';
import type { ResultPlace } from '../types';

export default function ResultPlaceCard({
  place,
  category,
  onSelect,
}: {
  place: ResultPlace;
  category: string;
  onSelect?: () => void;
}) {
  return (
    <article
      className={`result-place-card${onSelect ? ' result-place-card--tie' : ''}`}
      aria-label={place.name}
    >
      <span className="result-place-card__image" aria-hidden="true" />
      <div className="result-place-card__details">
        <h3>{place.name}</h3>
        <p>
          {category}
          {onSelect ? ` · ${place.distanceMeters}m · ${place.tieVotes ?? 0}표` : ''}
        </p>
        <p>{place.address}</p>
      </div>
      {onSelect ? (
        <Button
          className="result-place-card__select"
          onClick={onSelect}
          aria-label={`${place.name} 이곳으로 선택`}
        >
          이곳으로 선택
        </Button>
      ) : (
        <span className="result-place-card__badge">확정</span>
      )}
    </article>
  );
}
