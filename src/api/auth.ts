import { api } from './client';

// 기존 로그인 화면의 환경변수 검증에 사용한다.
export function getKakaoLoginUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}
export const getSession = api.getSession;
export const logout = api.logout;

type KakaoLoginOptions = (
  { inviteToken?: string; returnTo?: never } | { inviteToken?: never; returnTo: string }
) & {
  returnOrigin?: string;
};

export function getKakaoStartUrl(options: KakaoLoginOptions = {}): URL {
  return api.url('/api/auth/kakao/start', options);
}

export function startKakaoLogin(invite?: string | KakaoLoginOptions) {
  const options = typeof invite === 'string' ? { inviteToken: invite } : invite;
  window.location.assign(getKakaoStartUrl(options).href);
}
