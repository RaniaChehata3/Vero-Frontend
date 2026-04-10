// ── Activity Types ──
export type ActivityType = 'TRANSPORT' | 'FOOD' | 'ENERGY' | 'SHOPPING';
export type CalculationSource = 'MANUAL' | 'AUTO_CALCULATED';

// ── Carbon Activity ──
export interface CarbonActivity {
  id?: number;
  activityType: ActivityType;
  description: string;
  carbonKg: number;
  date: string;            // ISO date string: "2026-04-05"
  source: CalculationSource;
}

// ── Carbon Goal ──
export interface CarbonGoal {
  id?: number;
  activityType: ActivityType;
  targetCarbonKg: number;
  startDate: string;
  endDate: string;
  achieved: boolean;
  progressPct: number;
}

// ── Helper maps ──
export const ACTIVITY_ICONS: Record<ActivityType, string> = {
  TRANSPORT: '✈️',
  FOOD: '🍽️',
  ENERGY: '⚡',
  SHOPPING: '🛒'
};

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  TRANSPORT: 'Travel',
  FOOD: 'Food',
  ENERGY: 'Energy',
  SHOPPING: 'Shopping'
};

export const ACTIVITY_COLORS: Record<ActivityType, string> = {
  TRANSPORT: 'var(--fern)',
  FOOD: 'var(--earth)',
  ENERGY: 'var(--sage)',
  SHOPPING: 'var(--moss)'
};
