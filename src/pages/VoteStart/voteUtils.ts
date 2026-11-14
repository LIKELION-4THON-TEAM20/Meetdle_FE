import { HOUR } from '../PlaceRegistrationSetup/deadlineUtils';

export function getVoteDeadlineWindow(now: Date, meeting: Date) {
  const minimum = now.getTime() + HOUR / 2;
  const maximum = meeting.getTime() - 3 * HOUR;
  return {
    minimum,
    maximum,
    canOpen: Number.isFinite(minimum) && Number.isFinite(maximum) && minimum <= maximum,
  };
}

export function isValidVoteDeadline(deadline: Date, now: Date, meeting: Date) {
  const { minimum, maximum, canOpen } = getVoteDeadlineWindow(now, meeting);
  return (
    canOpen &&
    Number.isFinite(deadline.getTime()) &&
    deadline.getTime() >= minimum &&
    deadline.getTime() <= maximum
  );
}
