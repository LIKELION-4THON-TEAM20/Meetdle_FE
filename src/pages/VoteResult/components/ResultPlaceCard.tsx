import { getKakaoMapUrl } from '../../PlaceVote/voteUtils';
import type { ResultPlace } from '../types';
import restaurant from '../../../assets/vote-result/restaurant.svg';
import cafe from '../../../assets/vote-result/cafe.svg';
import pub from '../../../assets/vote-result/pub.svg';
import culture from '../../../assets/place-exploration/culture.png';

const icons: Record<string, string> = { restaurant, cafe, pub, culture, bar: pub };

export default function ResultPlaceCard({
  place,
  categoryId,
  selected,
  onSelect,
}: {
  place: ResultPlace;
  categoryId: string;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const mapUrl = getKakaoMapUrl(place.kakaoMapUrl);
  const icon = icons[categoryId];
  const distance = place.distanceMeters;
  return (
    <article
      className={`result-place-card${selected === true ? ' is-selected' : selected === false ? ' is-alternate' : ''}`}
      aria-label={place.name}
    >
      <span className="result-place-card__image" aria-hidden="true">
        {icon && (
          <img
            src={icon}
            alt=""
            className={
              categoryId === 'restaurant' || categoryId === 'cafe' ? 'fills-tile' : undefined
            }
          />
        )}
      </span>
      <div className="result-place-card__details">
        <div className="result-place-card__heading">
          <h3>{place.name}</h3>
          {onSelect && (
            <button
              type="button"
              className="result-place-card__select"
              aria-pressed={selected === true}
              aria-label={`${place.name} 선택`}
              onClick={onSelect}
            >
              선택
            </button>
          )}
        </div>
        {Number.isFinite(distance) && distance > 0 && (
          <p>
            역에서 {distance >= 1000 ? `${Number((distance / 1000).toFixed(1))}km` : `${distance}m`}
          </p>
        )}
        {place.address && <p className="result-place-card__address">{place.address}</p>}
        {mapUrl ? (
          <a className="result-place-card__map" href={mapUrl} target="_blank" rel="noreferrer">
            카카오맵 바로가기 ↗
          </a>
        ) : (
          <span className="result-place-card__map">카카오맵 미연동</span>
        )}
      </div>
    </article>
  );
}
