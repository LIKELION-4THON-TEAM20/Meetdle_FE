export type AppointmentStatus = 'in-progress' | 'completed';
export type AppointmentFilter = 'all' | 'upcoming' | 'past';

export interface Participant {
  id: string;
  name: string;
  imageUrl: string | null;
}

export interface Appointment {
  id: string;
  name: string;
  // 서버의 서비스 상태. 날짜가 지났다는 이유로 상태를 변경하지 않는다.
  status: AppointmentStatus;
  // 시간대 없는 약속 날짜 (YYYY-MM-DD). 날짜 필터와 D-day 계산에 사용한다.
  date: string;
  participants: Participant[];
  participantCount?: number;
  // 확인 가능한 진행 단계가 있는 개발용 목 약속에만 지정한다.
  entryPath?: string;
  badgeLabel?: string;
  canHide?: boolean;
}
