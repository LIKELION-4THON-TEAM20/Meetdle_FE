export type RegistrationStatus = 'beforeRegistration' | 'registrationOpen';

export const MOCK_MEETING_INFO = {
  registrationStatus: 'beforeRegistration' as RegistrationStatus,
  registrationCategories: ['식당', '카페', '주점', '문화시설'],
  registrationDeadline: '오늘 오후 10시까지',
  statusLabel: '일시·지역 확정',
  dateTime: '11월 15일 · 18:00',
  area: '왕십리역 근처',
  weekday: '일요일',
  hostName: '민수',
  participantCount: 4,
};
