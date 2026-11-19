export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)}m` : `${Number((meters / 1000).toFixed(1))}km`;
}
export function formatRemaining(deadline: number, now: number): string {
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}
