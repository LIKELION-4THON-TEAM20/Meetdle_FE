import { useEffect, useRef, useState } from 'react';
import type { ResultPlace } from '../../../api/types';
import RequestStatus from '../../../components/common/RequestStatus/RequestStatus';
import { loadKakaoMaps } from '../../../lib/kakaoMaps/loader';
import restaurant from '../../../assets/place-exploration/restaurant-registered.svg';
import cafe from '../../../assets/place-exploration/cafe-registered.svg';
import pub from '../../../assets/place-exploration/pub-registered.svg';
import culture from '../../../assets/place-exploration/culture-registered.svg';

const pins = { FOOD: restaurant, CAFE: cafe, BAR: pub, CULTURE: culture };

export default function ResultMap({ places, center }: {
  places: ResultPlace[];
  center: { lat: number; lng: number };
}) {
  const node = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState(false);
  const locations = JSON.stringify(places.map(({ candidateId, place }) => ({
    id: candidateId, name: place.name, category: place.category, lat: place.lat, lng: place.lng,
  })));
  useEffect(() => {
    if (!node.current) return;
    const canvas = node.current;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    setError(false);
    void loadKakaoMaps(import.meta.env.VITE_KAKAO_MAP_APP_KEY).then((maps) => {
      if (cancelled) return;
      const map = new maps.Map(canvas, {
        center: new maps.LatLng(center.lat, center.lng), level: 4,
        draggable: true, scrollwheel: true, keyboardShortcuts: true,
      });
      const entries: Array<{ name: string; category: keyof typeof pins; lat: number; lng: number }> = JSON.parse(locations);
      const markers = entries.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng)).map(place => {
        const marker = new maps.Marker({
          position: new maps.LatLng(place.lat, place.lng), title: place.name, clickable: false,
          image: new maps.MarkerImage(pins[place.category], new maps.Size(30, 47.094), { offset: new maps.Point(15, 47.094) }),
        });
        marker.setMap(map);
        return marker;
      });
      const observer = new ResizeObserver(() => map.relayout());
      observer.observe(canvas);
      dispose = () => { observer.disconnect(); markers.forEach(marker => marker.setMap(null)); canvas.replaceChildren(); };
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; dispose?.(); };
  }, [locations, center.lat, center.lng, attempt]);
  return <section className="vote-result-map" aria-label="확정 장소 지도">
    <div className="vote-result-map__canvas" ref={node} />
    {error && <RequestStatus title="지도를 불러오지 못했어요." description="잠시 후 다시 시도해주세요." onRetry={() => setAttempt(n => n + 1)} />}
  </section>;
}
