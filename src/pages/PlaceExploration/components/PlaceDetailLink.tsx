import { useEffect, useRef, type ReactNode } from 'react';
import {
  attemptKakaoPlace,
  isMobileBrowser,
  safeKakaoMapUrl,
} from '../../../lib/kakaoMaps/placeLink';
import type { RecommendedPlace } from '../types';

function PlaceDetailLink({
  place,
  children,
  className = 'exploration-place__detail',
  onActivate,
}: {
  place: RecommendedPlace;
  children: ReactNode;
  className?: string;
  onActivate?: () => void;
}) {
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), [place.id]);
  const url = safeKakaoMapUrl(place.kakaoMapUrl);
  if (!url)
    return (
      <span className={className} aria-disabled="true" title="카카오맵 상세 정보 미연결">
        {children}
      </span>
    );
  return (
    <a
      className={className}
      aria-label={`${place.name} 카카오맵에서 보기`}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        event.stopPropagation();
        onActivate?.();
        cleanup.current?.();
        if (
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          isMobileBrowser(navigator) &&
          place.kakaoPlaceId
        ) {
          event.preventDefault();
          cleanup.current = attemptKakaoPlace(place.kakaoPlaceId, url);
        }
      }}
    >
      {children}
    </a>
  );
}

export default PlaceDetailLink;
