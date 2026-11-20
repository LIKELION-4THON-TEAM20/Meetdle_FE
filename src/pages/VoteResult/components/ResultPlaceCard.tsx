import { getKakaoMapUrl } from '../../PlaceVote/voteUtils';
import { safeKakaoMapUrl } from '../../../lib/kakaoMaps/placeLink';
import type { ResultPlace } from '../types';
import restaurant from '../../../assets/place-exploration/restaurant-thumbnail.svg';
import cafe from '../../../assets/place-exploration/cafe-thumbnail.svg';
import pub from '../../../assets/place-exploration/pub-thumbnail.svg';
import culture from '../../../assets/place-exploration/culture-thumbnail.svg';

const icons: Record<string, string> = { restaurant, cafe, pub, culture, bar: pub };

export default function ResultPlaceCard({
  place,
  categoryId,
  selected,
  onSelect,
  serverProvided,
}: {
  place: Pick<ResultPlace, 'name' | 'address' | 'kakaoMapUrl'> & {
    distanceMeters?: number;
    imageUrl?: string;
  };
  categoryId: string;
  selected?: boolean;
  onSelect?: () => void;
  serverProvided?: boolean;
}) {
  const mapUrl = serverProvided
    ? safeKakaoMapUrl(place.kakaoMapUrl ?? null)
    : getKakaoMapUrl(place.kakaoMapUrl);
  const icon = icons[categoryId];
  const distance = place.distanceMeters;
  return (
    <article
      className={`result-place-card${selected === true ? ' is-selected' : selected === false ? ' is-alternate' : ''}`}
      aria-label={place.name}
    >
      <span className="result-place-card__image" aria-hidden="true">
        {(place.imageUrl || icon) && (
          <img
            src={place.imageUrl ?? icon}
            alt=""
            className="fills-tile"
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
        <p className="result-place-card__distance" aria-hidden={distance === undefined}>
          {distance !== undefined && Number.isFinite(distance) && distance >= 0 && (<>
            역에서 {distance >= 1000 ? `${Number((distance / 1000).toFixed(1))}km` : `${distance}m`}
          </>)}
        </p>
        {place.address && <p className="result-place-card__address">{place.address}</p>}
        {mapUrl ? (
          <a className="result-place-card__map" href={mapUrl} target="_blank" rel="noreferrer">
            카카오맵 바로가기 ↗
          </a>
        ) : (
          <span className="result-place-card__map" aria-disabled="true" title="등록된 카카오맵 링크가 없어요">카카오맵 바로가기 ↗</span>
        )}
      </div>
    </article>
  );
}
