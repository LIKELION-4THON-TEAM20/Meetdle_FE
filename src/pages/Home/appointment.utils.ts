import type { Appointment, AppointmentFilter } from './appointment.types';

const MILLISECONDS_PER_DAY = 86_400_000;

export function getTodayKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function getDayDifference(date: string, today: string): number {
  return Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / MILLISECONDS_PER_DAY,
  );
}

export function getAppointmentBadge(appointment: Appointment, today: string): string {
  if (appointment.status === 'completed') return '완료';
  const difference = getDayDifference(appointment.date, today);
  return difference === 0
    ? 'D-day'
    : difference > 0
      ? `D-${difference}`
      : `D+${Math.abs(difference)}`;
}

export function filterAppointments(
  appointments: Appointment[],
  filter: AppointmentFilter,
  today: string,
): Appointment[] {
  if (filter === 'all') return appointments;
  return appointments.filter((appointment) =>
    filter === 'upcoming' ? appointment.date >= today : appointment.date < today,
  );
}

export function formatAppointmentDate(date: string): string {
  const [, month, day] = date.split('-');
  return `${Number(month)}.${Number(day)}`;
}
