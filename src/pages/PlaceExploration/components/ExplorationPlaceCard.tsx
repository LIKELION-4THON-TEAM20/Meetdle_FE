import { useId, useState } from 'react';
import Button from '../../../components/common/Button/Button';
import PlaceDetailLink from './PlaceDetailLink';
import restaurantThumbnail from '../../../assets/place-exploration/restaurant-thumbnail.svg';
import cafeThumbnail from '../../../assets/place-exploration/cafe-thumbnail.svg';
import pubThumbnail from '../../../assets/place-exploration/pub-thumbnail.svg';
import cultureThumbnail from '../../../assets/place-exploration/culture-thumbnail.svg';
import { formatDistance } from '../placeUtils';
import type { RecommendedPlace } from '../types';

const CATEGORY_THUMBNAILS = {
  restaurant: restaurantThumbnail,
  cafe: cafeThumbnail,
  pub: pubThumbnail,
  culture: cultureThumbnail,
};

interface ExplorationPlaceCardProps {
  place: RecommendedPlace;
  categoryLabel: string;
  blocked: string | null;
  pending: boolean;
  registered?: boolean;
  selected?: boolean;
  showRegister?: boolean;
  onSelect?: () => void;
  onRemove?: () => void;
  removeDisabled?: boolean;
  onRegister: (submittedAt: number) => void;
}

function ExplorationPlaceCard({
  place,
  categoryLabel,
  blocked,
  pending,
  registered = false,
  selected = false,
  showRegister = true,
  onSelect,
  onRemove,
  removeDisabled,
  onRegister,
}: ExplorationPlaceCardProps) {
  const descriptionId = useId();
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const hasImage = !!place.imageUrl?.trim() && place.imageUrl !== failedImage;
  const thumbnail = hasImage ? place.imageUrl : CATEGORY_THUMBNAILS[place.categoryId];
  return (
    <article
      className={`exploration-place-card${selected ? ' exploration-place-card--selected' : ''}`}
      aria-label={`${place.name}, ${categoryLabel}`}
    >
      {onSelect && (
        <button
          type="button"
          className="exploration-place-card__select"
          aria-label={`${place.name} 지도에서 선택`}
          aria-pressed={selected}
          onClick={onSelect}
        />
      )}
      <div className="exploration-place-card__thumb-frame">
        <img
          className="exploration-place-card__thumb"
          data-fallback={!hasImage}
          src={thumbnail}
          alt=""
          onError={() => {
            if (place.imageUrl && thumbnail === place.imageUrl) setFailedImage(place.imageUrl);
          }}
        />
      </div>
      <div className="exploration-place-card__info">
        <h3 title={place.name}>{place.name}</h3>
        <p
          className="exploration-place-card__distance"
          aria-hidden={place.distanceMeters === undefined ? true : undefined}
        >
          {place.distanceMeters !== undefined && `역에서 ${formatDistance(place.distanceMeters)}`}
        </p>
        <p className="exploration-place-card__address" title={place.address}>
          {place.address}
        </p>
      </div>
      <div className="exploration-place-card__actions">
        {onRemove && (
          <button
            className="exploration-place-card__remove"
            type="button"
            aria-label={`${place.name} 등록 취소`}
            disabled={removeDisabled || pending}
            onClick={onRemove}
          >
            <span aria-hidden="true">×</span>
          </button>
        )}
        {showRegister && (
          <Button
            className="exploration-place-card__register"
            data-registered={registered}
            disabled={registered || !!blocked || pending}
            aria-label={`${place.name} ${registered ? '이미 등록한 장소' : '등록하기'}`}
            aria-describedby={blocked ? descriptionId : undefined}
            aria-busy={pending}
            onClick={() => onRegister(Date.now())}
          >
            {pending ? '등록 중…' : registered ? '선택' : '등록하기'}
          </Button>
        )}
        <PlaceDetailLink place={place} className="exploration-place-card__detail">
          카카오맵 바로가기↗︎
        </PlaceDetailLink>
      </div>
      {blocked && (
        <span id={descriptionId} className="exploration-place-card__reason">
          {blocked}
        </span>
      )}
    </article>
  );
}
export default ExplorationPlaceCard;
