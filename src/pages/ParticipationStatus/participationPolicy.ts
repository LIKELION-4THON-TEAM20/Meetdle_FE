export const MINIMUM_COMPLETED_COUNT = 2;

export function getParticipationActions(completedCount: number, totalCount: number) {
  const meetsMinimum = completedCount >= MINIMUM_COMPLETED_COUNT;
  const allCompleted = totalCount > 0 && completedCount === totalCount;

  return {
    meetsMinimum,
    allCompleted,
    showReminder: completedCount < totalCount,
    showHostNotification: meetsMinimum || allCompleted,
    canNotifyHost: allCompleted,
  };
}
