import type { KakaoMaps } from './types';

let pending: { key: string; promise: Promise<KakaoMaps> } | null = null;
const SCRIPT_ID = 'meetdle-kakao-maps-sdk';
function ready(maps: Partial<KakaoMaps> | undefined): maps is KakaoMaps {
  return !!(maps?.Map && maps.Circle && maps.Marker && maps.MarkerClusterer);
}

export function loadKakaoMaps(appKey: string | undefined): Promise<KakaoMaps> {
  const key = appKey?.trim();
  if (!key)
    return Promise.reject(
      new Error('지도 JavaScript 앱 키가 없어요. VITE_KAKAO_MAP_APP_KEY를 설정해주세요.'),
    );
  if (pending)
    return pending.key === key
      ? pending.promise
      : Promise.reject(
          new Error('다른 앱 키로 지도가 로딩 중이에요. 설정 후 페이지를 새로고침해주세요.'),
        );
  const existing = document.querySelector<HTMLScriptElement>(
    'script[src*="dapi.kakao.com/v2/maps/sdk.js"]',
  );
  if (existing && new URL(existing.src).searchParams.get('appkey') !== key)
    return Promise.reject(
      new Error('다른 앱 키의 지도 SDK가 이미 있어요. 페이지를 새로고침해주세요.'),
    );
  if (ready(window.kakao?.maps)) return Promise.resolve(window.kakao.maps);

  const promise = new Promise<KakaoMaps>((resolve, reject) => {
    const script = existing ?? document.createElement('script');
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      script.removeEventListener('load', loaded);
      script.removeEventListener('error', failed);
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      cleanup();
      if (script.id === SCRIPT_ID) script.remove();
      reject(
        new Error(
          '카카오 지도를 불러오지 못했어요. 네트워크, JavaScript 키, 카카오맵 사용 설정과 현재 도메인 등록을 확인해주세요.',
        ),
      );
    };
    const loaded = () => {
      try {
        if (!window.kakao?.maps?.load) {
          fail();
          return;
        }
        window.kakao.maps.load(() => {
          if (settled) return;
          if (!ready(window.kakao?.maps)) {
            fail();
            return;
          }
          settled = true;
          cleanup();
          resolve(window.kakao.maps);
        });
      } catch {
        fail();
      }
    };
    const failed = () => fail();
    const timer = setTimeout(fail, 15000);
    script.addEventListener('load', loaded);
    script.addEventListener('error', failed);
    if (!existing) {
      script.id = SCRIPT_ID;
      script.async = true;
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false&libraries=clusterer`;
      document.head.append(script);
    } else if (window.kakao?.maps?.load) loaded();
  });
  const entry = { key, promise };
  pending = entry;
  void promise.catch(() => {
    if (pending === entry) pending = null;
  });
  return promise;
}
