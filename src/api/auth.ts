// 백엔드가 state 검증과 카카오 인가 코드 처리를 담당하는 로그인 시작 주소.
export function getKakaoLoginUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}
