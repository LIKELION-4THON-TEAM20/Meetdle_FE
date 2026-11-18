import { useEffect, useRef, useState } from 'react';
import Button from '../../../components/common/Button/Button';
import { loadKakaoMaps } from '../../../lib/kakaoMaps/loader';
import { createPlaceMap } from '../../../lib/kakaoMaps/controller';
import { formatDistance } from '../placeUtils';
import type { ExplorationArea, RecommendedPlace } from '../types';

interface ExplorationMapProps {
  area: ExplorationArea;
  places: readonly RecommendedPlace[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  appKey?: string;
}

function ExplorationMap({
  area,
  places,
  selectedId,
  onSelect,
  appKey = import.meta.env.VITE_KAKAO_MAP_APP_KEY,
}: ExplorationMapProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<ReturnType<typeof createPlaceMap> | null>(null);
  const onSelectRef = useRef(onSelect);
  const [attempt, setAttempt] = useState(0);
  const [generation, setGeneration] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  const { latitude, longitude } = area.center;
  const radius = area.radiusMeters;
  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    let controller: ReturnType<typeof createPlaceMap> | undefined;
    let resizeFrame = 0;
    loadKakaoMaps(appKey)
      .then((maps) => {
        if (cancelled) return;
        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          !Number.isFinite(radius) ||
          radius <= 0
        )
          throw new Error('지도 중심 좌표와 반경을 확인해주세요.');
        controller = createPlaceMap(
          maps,
          node,
          { center: { latitude, longitude }, radiusMeters: radius },
          (id) => onSelectRef.current(id),
        );
        controllerRef.current = controller;
        observer = new ResizeObserver(() => {
          if (cancelled) return;
          cancelAnimationFrame(resizeFrame);
          resizeFrame = requestAnimationFrame(() => controller?.resize());
        });
        observer.observe(node);
        setStatus('ready');
        setGeneration((value) => value + 1);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : '지도를 표시하지 못했어요.');
        setStatus('error');
      });
    return () => {
      cancelled = true;
      observer?.disconnect();
      cancelAnimationFrame(resizeFrame);
      controller?.dispose();
      controllerRef.current = null;
    };
  }, [appKey, latitude, longitude, radius, attempt]);
  useEffect(() => {
    if (status === 'ready') controllerRef.current?.update(places, selectedId);
  }, [status, places, selectedId, generation]);

  return (
    <section className="exploration-map" aria-label="추천 장소 지도">
      <div className="exploration-map__canvas" ref={nodeRef} aria-label="카카오 지도" />
      {status === 'ready' ? (
        <>
          <span className="exploration-map__outside">반경 밖 · 등록 불가</span>
          <span className="exploration-map__radius">반경 {formatDistance(radius)} · 등록 가능</span>
          <Button className="exploration-map__reset" onClick={() => controllerRef.current?.fit()}>
            ⟲ 처음 위치로
          </Button>
        </>
      ) : (
        <div className="exploration-map__state" role="status">
          {status === 'loading' ? (
            <p>지도를 불러오는 중이에요.</p>
          ) : (
            <>
              <p>{error}</p>
              <Button
                variant="secondary"
                onClick={() => {
                  setStatus('loading');
                  setAttempt((value) => value + 1);
                }}
              >
                지도 다시 시도
              </Button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

export default ExplorationMap;
