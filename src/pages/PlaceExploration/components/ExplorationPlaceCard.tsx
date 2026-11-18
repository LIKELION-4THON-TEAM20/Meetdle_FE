import { useId, useState } from 'react';
import Button from '../../../components/common/Button/Button';
import PlaceDetailLink from './PlaceDetailLink';
import restaurantThumbnail from '../../../assets/place-exploration/restaurant-thumbnail.svg';
import cafeThumbnail from '../../../assets/place-exploration/cafe-thumbnail.svg';
import pubThumbnail from '../../../assets/place-exploration/pub-thumbnail.png';
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
  onRegister,
}: ExplorationPlaceCardProps) {
  const descriptionId = useId();
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const thumbnail =
    place.imageUrl?.trim() && place.imageUrl !== failedImage
      ? place.imageUrl
      : CATEGORY_THUMBNAILS[place.categoryId];
  return (
    <article
      className={`exploration-place-card${selected ? ' exploration-place-card--selected' : ''}`}
      aria-label={`${place.name}, ${categoryLabel}`}
    >
      <img
        className="exploration-place-card__thumb"
        src={thumbnail}
        alt=""
        onError={() => {
          if (place.imageUrl && thumbnail === place.imageUrl) setFailedImage(place.imageUrl);
        }}
      />
      <div className="exploration-place-card__info">
        <h3 title={place.name}>{place.name}</h3>
        {place.distanceMeters !== undefined && (
          <p className="exploration-place-card__distance">
            역에서 {formatDistance(place.distanceMeters)}
          </p>
        )}
        <p className="exploration-place-card__address" title={place.address}>
          {place.address}
        </p>
      </div>
      <div className="exploration-place-card__actions">
        {showRegister && (
          <Button
            className="exploration-place-card__register"
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
          카카오맵 바로가기↗
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
