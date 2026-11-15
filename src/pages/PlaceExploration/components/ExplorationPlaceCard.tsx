import Button from '../../../components/common/Button/Button';
import PlaceDetailLink from './PlaceDetailLink';
import { formatDistance } from '../placeUtils';
import type { RecommendedPlace } from '../types';

function ExplorationPlaceCard({
  place,
  categoryLabel,
  blocked,
  pending,
  onRegister,
}: {
  place: RecommendedPlace;
  categoryLabel: string;
  blocked: string | null;
  pending: boolean;
  onRegister: (submittedAt: number) => void;
}) {
  return (
    <section
      className={`exploration-place${!place.eligible ? ' exploration-place--outside' : ''}`}
      aria-label="선택한 장소"
    >
      <p className="exploration-place__label">선택한 장소</p>
      <div className="exploration-place__row">
        {place.imageUrl ? (
          <img className="exploration-place__thumb" src={place.imageUrl} alt="" />
        ) : (
          <span className="exploration-place__thumb" aria-hidden="true" />
        )}
        <div className="exploration-place__info">
          <h3>{place.name}</h3>
          <p>
            {categoryLabel} · {formatDistance(place.distanceMeters)}
          </p>
          <p>{place.address}</p>
        </div>
        <Button
          className="exploration-place__register"
          disabled={!!blocked || pending}
          aria-busy={pending}
          onClick={() => onRegister(Date.now())}
        >
          {pending ? '등록 중…' : '등록하기'}
        </Button>
      </div>
      <PlaceDetailLink key={place.id} place={place} />
      {blocked && <p className="exploration-place__blocked">{blocked}</p>}
    </section>
  );
}
export default ExplorationPlaceCard;
