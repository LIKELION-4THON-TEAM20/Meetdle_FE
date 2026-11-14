export const HOUR = 60 * 60 * 1000;

export function getDeadlineWindow(now: number, meetingStartsAt: number) {
  const minimum = now + HOUR;
  const maximum = meetingStartsAt - 3 * HOUR;
  return {
    minimum,
    maximum,
    canOpen: Number.isFinite(minimum) && Number.isFinite(maximum) && minimum <= maximum,
    under24Hours: meetingStartsAt - now < 24 * HOUR,
  };
}

export function isValidDeadline(deadline: number, now: number, meetingStartsAt: number) {
  const { minimum, maximum, canOpen } = getDeadlineWindow(now, meetingStartsAt);
  return canOpen && Number.isFinite(deadline) && deadline >= minimum && deadline <= maximum;
}

export function toLocalDateTime(timestamp: number) {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDeadline(timestamp: number, now: number) {
  const date = new Date(timestamp);
  const today = new Date(now);
  const day =
    date.toDateString() === today.toDateString()
      ? '오늘'
      : `${date.getMonth() + 1}월 ${date.getDate()}일`;
  const hour = date.getHours();
  return `${day} ${hour < 12 ? '오전' : '오후'} ${hour % 12 || 12}:${String(date.getMinutes()).padStart(2, '0')}`;
}
