import { isServerRoomId } from '../../api/rooms';
import { LOGIN_RETURN_KEY, PATHS, safeReturnTo } from '../../router/paths';

export function rememberLoginReturn(storage: Pick<Storage, 'setItem'>, path: string) {
  storage.setItem(LOGIN_RETURN_KEY, safeReturnTo(path));
}
export function consumeLoginReturn(storage: Pick<Storage, 'getItem' | 'removeItem'>): string {
  const path = safeReturnTo(storage.getItem(LOGIN_RETURN_KEY));
  storage.removeItem(LOGIN_RETURN_KEY);
  return path;
}
export function loginErrorMessage(value: string | null): string | undefined {
  if (!value) return undefined;
  return value === 'access_denied' || value === 'CANCELLED'
    ? '카카오 로그인이 취소됐어요. 다시 시도해주세요.'
    : '카카오 로그인을 완료하지 못했어요. 다시 시도해주세요.';
}
export function inviteReturnPath(token: string): string {
  return `${PATHS.invitation}?inviteToken=${encodeURIComponent(token)}`;
}

// The server accepts only /rooms/{UUID} as returnTo; other safe UI paths stay in sessionStorage.
export function kakaoLoginOptions(origin: string, destination: string, inviteToken?: string) {
  if (inviteToken) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(inviteToken)) throw new TypeError('Invalid invitation token');
    return { inviteToken, returnOrigin: origin };
  }
  const path = safeReturnTo(destination);
  const match = /^\/rooms\/([0-9a-f-]+)$/.exec(new URL(path, 'https://meetdle.invalid').pathname);
  return match && isServerRoomId(match[1])
    ? { returnTo: `/rooms/${match[1]}`, returnOrigin: origin }
    : { returnOrigin: origin };
}

export function clearMatchingLoginReturn(
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
  destination: string,
) {
  if (safeReturnTo(storage.getItem(LOGIN_RETURN_KEY)) === safeReturnTo(destination))
    storage.removeItem(LOGIN_RETURN_KEY);
}
