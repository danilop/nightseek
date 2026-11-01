import type { Location, Settings } from '@/types';
import type { ForecastResult } from '../analyzer';

export interface ForecastRequest {
  location: Location;
  settings: Settings;
  referenceDate: Date; // One request-time instant for both UI and worker calculations
}

export type ForecastMessage =
  | { type: 'progress'; message: string; percent: number }
  | { type: 'partial' | 'complete'; result: ForecastResult }
  | { type: 'error'; message: string };
