export type CategoryId = 'restaurant' | 'cafe' | 'pub' | 'culture';
export interface Category {
  id: CategoryId;
  label: string;
  required: boolean;
}
export type DeadlineMode = 'oneHour' | 'threeHours' | 'custom';
