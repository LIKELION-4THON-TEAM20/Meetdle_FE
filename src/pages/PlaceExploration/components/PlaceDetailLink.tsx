import { useEffect, useRef } from 'react';
import {
  attemptKakaoPlace,
  isMobileBrowser,
  safeKakaoMapUrl,
} from '../../../lib/kakaoMaps/placeLink';
import type { RecommendedPlace } from '../types';

function PlaceDetailLink({ place }: { place: RecommendedPlace }) {
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);
  const url = safeKakaoMapUrl(place.kakaoMapUrl);
  if (!url)
    return (
      <span className="exploration-place__detail" aria-disabled="true">
        카카오맵 상세 정보 미연결
      </span>
    );
  return (
    <a
      className="exploration-place__detail"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        event.stopPropagation();
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
      카카오맵 상세 보기
    </a>
  );
}

export default PlaceDetailLink;
