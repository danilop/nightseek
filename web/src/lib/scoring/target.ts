import type {
  AstronomicalEvents,
  NightInfo,
  NightWeather,
  ObjectVisibility,
  ScoredObject,
} from '@/types';
import type { SkyCalculator } from '../astronomy/calculator';
import { calculateImagingWindows } from '../astronomy/imaging-windows';
import { calculateTotalScore } from './index';

/** Shared preparation and scoring for forecasts and catalog search. */
export function scoreTargetForNight(
  visibility: ObjectVisibility,
  night: NightInfo,
  weather: NightWeather | null,
  calculator: SkyCalculator,
  events: AstronomicalEvents,
  fov: { width: number; height: number } | null,
  sunRa = calculator.getSunPosition(night.date).ra
): ScoredObject {
  const imagingWindows = calculateImagingWindows(visibility, night, weather, calculator);
  const prepared = { ...visibility, imagingWindows, imagingWindow: imagingWindows[0] };
  return calculateTotalScore(
    prepared,
    night,
    weather,
    sunRa,
    events.oppositions,
    events.lunarApsis,
    events.venusPeak,
    fov
  );
}
