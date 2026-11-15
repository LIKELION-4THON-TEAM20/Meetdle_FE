export const PATHS = {
  home: '/',
  login: '/login',
  create: '/rooms/create',
  created: '/rooms/create/complete',
  invitation: '/rooms/invite',
  legacyJoin: '/rooms/join',
  participation: '/rooms/participation-status',
  confirmed: '/rooms/confirmed',
  info: '/rooms/info',
  setup: '/rooms/registration/setup',
  registration: '/rooms/registration/status',
  closeRegistration: '/rooms/registration/close',
  startVote: '/rooms/vote/start',
  vote: '/rooms/vote',
  voteStatus: '/rooms/vote/status',
  result: '/rooms/vote/result',
} as const;

export const MOCK_ROOM_ID = 'mock-room-10-14';

// 방과 개발용 역할만 이어 간다. reset/scenario/clock은 명시된 목적지에만 적용한다.
export function roomPath(path: string, search: string, defaultRoomId?: string): string {
  if (path === PATHS.home) return PATHS.home;
  const current = new URLSearchParams(search);
  const target = new URL(path, 'https://meetdle.invalid');
  for (const key of ['roomId', 'role']) {
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
    Object.values(PATHS).some((path) => path !== PATHS.login && path === url.pathname)
    ? `${url.pathname}${url.search}${url.hash}`
    : PATHS.home;
}

export const LOGIN_RETURN_KEY = 'meetdle:oauth:return-to:v1';
