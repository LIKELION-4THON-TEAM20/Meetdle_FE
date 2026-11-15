export function safeKakaoMapUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') &&
      ['map.kakao.com', 'place.map.kakao.com', 'm.map.kakao.com'].includes(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function isMobileBrowser(
  navigator: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'>,
): boolean {
  return (
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

// 브라우저는 설치 여부를 확실히 알 수 없다. 숨김/이탈은 중복 fallback 방지 신호로만 사용한다.
export function attemptKakaoPlace(
  kakaoPlaceId: string,
  webUrl: string,
  environment = { document, window },
) {
  const doc = environment.document;
  const win = environment.window;
  const cancel = () => {
    clearTimeout(timer);
    doc.removeEventListener('visibilitychange', visibilityChanged);
    win.removeEventListener('pagehide', cancel);
  };
  const visibilityChanged = () => {
    if (doc.visibilityState === 'hidden') cancel();
  };
  doc.addEventListener('visibilitychange', visibilityChanged);
  win.addEventListener('pagehide', cancel, { once: true });
  const timer = setTimeout(() => {
    cancel();
    if (doc.visibilityState === 'visible') win.location.assign(webUrl);
  }, 1500);
  try {
    win.location.assign(`kakaomap://place?id=${encodeURIComponent(kakaoPlaceId)}`);
  } catch {
    cancel();
    win.location.assign(webUrl);
  }
  return cancel;
}
