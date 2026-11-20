import { isServerRoomId } from '../api/rooms';

export const PATHS = {
  home: '/',
  login: '/login',
  create: '/rooms/create',
  created: '/rooms/create/complete',
  invitation: '/rooms/invite',
  legacyJoin: '/rooms/join',
  schedule: '/rooms/schedule-transit',
  recruitment: '/rooms/recruitment',
  participation: '/rooms/participation-status',
  candidates: '/rooms/candidates',
  confirmed: '/rooms/confirmed',
  info: '/rooms/info',
  setup: '/rooms/registration/setup',
  places: '/rooms/places',
  registration: '/rooms/registration/status',
  closeRegistration: '/rooms/registration/close',
  startVote: '/rooms/vote/start',
  vote: '/rooms/vote',
  voteStatus: '/rooms/vote/status',
  result: '/rooms/vote/result',
} as const;

export function getRoomBackPath(fallback: string, search: string): string {
  return new URLSearchParams(search).get('from') === 'home' ? PATHS.home : fallback;
}

// 다음 화면에는 방 ID만 전달한다.
export function roomPath(path: string, search: string, defaultRoomId?: string): string {
  if (path === PATHS.home) return PATHS.home;
  const current = new URLSearchParams(search);
  const target = new URL(path, 'https://meetdle.invalid');
  for (const key of ['roomId']) {
    const value = current.get(key) ?? (key === 'roomId' ? defaultRoomId : null);
    if (value && !target.searchParams.has(key)) target.searchParams.set(key, value);
  }
  return `${target.pathname}${target.search}${target.hash}`;
}

export function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value))
    return PATHS.home;
  const url = new URL(value, 'https://meetdle.invalid');
  return url.origin === 'https://meetdle.invalid' &&
    (url.pathname === '/rooms' ||
      /^\/invite\/[A-Za-z0-9_-]{43}$/.test(url.pathname) ||
      Object.values(PATHS).some((path) => path !== PATHS.login && path === url.pathname) ||
      (url.pathname.startsWith('/rooms/') &&
        isServerRoomId(url.pathname.slice('/rooms/'.length))) ||
      /^\/invitations\/[A-Za-z0-9_-]{43}$/.test(url.pathname))
    ? `${url.pathname}${url.search}${url.hash}`
    : PATHS.home;
}

export const LOGIN_RETURN_KEY = 'meetdle:oauth:return-to:v1';
