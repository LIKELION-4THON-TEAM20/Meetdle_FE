import type { Appointment, Participant } from './appointment.types';

// 디자인의 회색 참여자 이미지는 실제 사진이 아닌 플레이스홀더다.
const MOCK_PARTICIPANTS: Participant[] = Array.from({ length: 4 }, (_, index) => ({
  id: `participant-${index + 1}`,
  name: `참여자 ${index + 1}`,
  imageUrl: null,
}));

export const MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: 'autumn-outing',
    name: '가을 나들이',
    status: 'in-progress',
    date: '2026-11-27',
    participants: MOCK_PARTICIPANTS,
  },
  {
    id: 'culture',
    name: '문화생활',
    status: 'completed',
    date: '2026-11-09',
    participants: MOCK_PARTICIPANTS,
  },
  {
    id: 'exhibition',
    name: '전시 모임',
    status: 'completed',
    date: '2026-11-03',
    participants: MOCK_PARTICIPANTS,
  },
];
