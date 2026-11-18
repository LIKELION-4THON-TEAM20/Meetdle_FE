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
  return value === 'access_denied'
    ? '카카오 로그인이 취소됐어요. 다시 시도해주세요.'
    : '카카오 로그인을 완료하지 못했어요. 다시 시도해주세요.';
}
export function inviteReturnPath(token: string): string {
  return `${PATHS.invitation}?inviteToken=${encodeURIComponent(token)}`;
}
