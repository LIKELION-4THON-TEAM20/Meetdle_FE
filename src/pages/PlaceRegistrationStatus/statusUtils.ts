import { HOUR } from '../PlaceRegistrationSetup/deadlineUtils';

export function getRegistrationExtensionWindow(deadline: number, now: number, meeting: number) {
  return {
    minimum: Math.max(deadline + 1, now + HOUR),
    maximum: meeting - 3.5 * HOUR,
  };
}

export function isValidRegistrationExtension(
  value: number,
  deadline: number,
  now: number,
  meeting: number,
) {
  const { minimum, maximum } = getRegistrationExtensionWindow(deadline, now, meeting);
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}
