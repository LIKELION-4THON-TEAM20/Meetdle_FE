import Button from '../../../components/common/Button/Button';
import { safeKakaoMapUrl } from '../../../lib/kakaoMaps/placeLink';
import type { VoteChoice, VotePlace } from '../types';
import { getKakaoMapUrl, voteChoices } from '../voteUtils';
import './PlaceVoteCard.scss';

interface Props {
  place: Omit<VotePlace, 'distanceMeters'> & { distanceMeters?: number; imageUrl?: string };
  category: string;
  automatic: boolean;
  choice?: VoteChoice;
  locked: boolean;
  serverProvided?: boolean;
  onChoose: (choice: VoteChoice) => void;
}

export default function PlaceVoteCard({
  place,
  category,
  automatic,
  choice,
  locked,
  serverProvided,
  onChoose,
}: Props) {
  const mapUrl = serverProvided
    ? safeKakaoMapUrl(place.kakaoMapUrl ?? null)
    : getKakaoMapUrl(place.kakaoMapUrl);
  return (
    <article
      className={`place-vote-card${automatic ? ' place-vote-card--automatic' : ''}${locked && !automatic ? ' place-vote-card--locked' : ''}`}
      aria-labelledby={`place-${place.id}`}
    >
      <div className="place-vote-card__heading">
        <div className="place-vote-card__info">
          <h4 id={`place-${place.id}`}>{place.name}</h4>
          <div className="place-vote-card__details">
            <p>{category}{Number.isFinite(place.distanceMeters) && ` · ${place.distanceMeters}m`}</p>
            <p>{place.address}</p>
          </div>
        </div>
        {automatic ? <span className="place-vote-card__badge">자동 선정</span> : null}
        {mapUrl && !automatic ? (
          <a
            className="place-vote-card__map"
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${place.name} 카카오맵 바로가기 (새 탭)`}
          >
            카카오맵 바로가기 ›
          </a>
        ) : !automatic ? (
          <span
            className="place-vote-card__map"
            aria-disabled="true"
            title="등록된 카카오맵 링크가 없어요"
          >
            카카오맵 바로가기 ›
          </span>
        ) : null}
      </div>
      {automatic ? (
        <p className="place-vote-card__automatic-note">후보가 1곳뿐이라 투표 없이 선정돼요.</p>
      ) : (
        <div className="place-vote-card__choices" role="group" aria-label={`${place.name} 선호도`}>
          {voteChoices.map((option) => (
            <Button
              key={option.value}
              className={`place-vote-card__choice${choice === option.value ? ' is-selected' : ''}`}
              aria-pressed={choice === option.value}
              disabled={locked}
              onClick={() => onChoose(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      )}
    </article>
  );
}
