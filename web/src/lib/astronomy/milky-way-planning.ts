import { calculateImagingWindows } from '@/lib/astronomy/imaging-windows';
import { evaluateTargetAccessibility, type TargetAccessibility } from '@/lib/utils/horizon-profile';
import { getBestPhotoReadyWindow, type PhotoReadyWindow } from '@/lib/utils/target-photo-windows';
import type {
  HorizonProfile,
  MilkyWayBandSample,
  MilkyWaySection,
  NightForecast,
  ObjectVisibility,
} from '@/types';
import type { SkyCalculator } from './calculator';

export interface MilkyWaySamplePlan {
  section: MilkyWaySection;
  sample: MilkyWayBandSample;
  accessibility: TargetAccessibility;
  qualityWindow: PhotoReadyWindow | null;
  candidateWindow: PhotoReadyWindow | null;
  photoWindow: PhotoReadyWindow | null;
  planningScore: number;
}

export interface GalacticCorePlan {
  visibility: ObjectVisibility;
  accessibility: TargetAccessibility;
  candidateWindow: PhotoReadyWindow | null;
  photoWindow: PhotoReadyWindow | null;
}

export interface MilkyWayNightPlan {
  forecast: NightForecast;
  samples: MilkyWaySamplePlan[];
  bestSample: MilkyWaySamplePlan | null;
  core: GalacticCorePlan;
  isAstronomicallyDark: boolean;
  transparencyReady: boolean;
  skyglowReady: boolean;
}

function hasAstronomicalDarkness(forecast: NightForecast): boolean {
  return (
    forecast.nightInfo.observingWindowMode === 'astronomical' ||
    forecast.nightInfo.observingWindowMode === 'continuous'
  );
}

function toPhotoReadyWindow(
  window: NonNullable<ReturnType<typeof calculateImagingWindows>[number]>
): PhotoReadyWindow {
  return {
    ...window,
    durationMinutes: (window.end.getTime() - window.start.getTime()) / 60_000,
  };
}

function evaluateVisibility(
  visibility: ObjectVisibility,
  forecast: NightForecast,
  horizonProfile: HorizonProfile,
  calculator: SkyCalculator
): {
  accessibility: TargetAccessibility;
  qualityWindow: PhotoReadyWindow | null;
  candidateWindow: PhotoReadyWindow | null;
} {
  const accessibility = evaluateTargetAccessibility(visibility, horizonProfile, forecast.weather);
  const imagingWindows = calculateImagingWindows(
    visibility,
    forecast.nightInfo,
    forecast.weather,
    calculator
  );

  return {
    accessibility,
    qualityWindow: imagingWindows[0] ? toPhotoReadyWindow(imagingWindows[0]) : null,
    candidateWindow: getBestPhotoReadyWindow(imagingWindows, accessibility),
  };
}

function calculatePlanningScore(
  section: MilkyWaySection,
  sample: MilkyWayBandSample,
  candidateWindow: PhotoReadyWindow | null
): number {
  const windowQuality = candidateWindow?.qualityScore ?? 0;
  const durationBonus = Math.min(candidateWindow?.durationMinutes ?? 0, 240) / 12;
  const altitudeFallback = Math.max(0, sample.visibility.maxAltitude) / 5;
  const prominenceMultiplier = 0.65 + section.relativeProminence * 0.35;
  return (windowQuality + durationBonus + altitudeFallback) * prominenceMultiplier;
}

function compareSamplePlans(a: MilkyWaySamplePlan, b: MilkyWaySamplePlan): number {
  return (
    Number(Boolean(a.photoWindow)) - Number(Boolean(b.photoWindow)) ||
    Number(Boolean(a.candidateWindow)) - Number(Boolean(b.candidateWindow)) ||
    Number(a.accessibility.isAccessible) - Number(b.accessibility.isAccessible) ||
    a.planningScore - b.planningScore
  );
}

export function buildMilkyWayNightPlan(
  forecast: NightForecast,
  horizonProfile: HorizonProfile,
  calculator: SkyCalculator,
  bortleClass: number
): MilkyWayNightPlan {
  const isAstronomicallyDark = hasAstronomicalDarkness(forecast);
  const transparency = forecast.weather?.transparencyScore;
  const transparencyReady =
    transparency === null || transparency === undefined || transparency >= 30;
  const skyglowReady = bortleClass < 7;

  const samples = forecast.milkyWay.sections.flatMap(section =>
    section.samples.map(sample => {
      const evaluated = evaluateVisibility(sample.visibility, forecast, horizonProfile, calculator);
      return {
        section,
        sample,
        ...evaluated,
        photoWindow:
          isAstronomicallyDark && transparencyReady && skyglowReady
            ? evaluated.candidateWindow
            : null,
        planningScore: calculatePlanningScore(section, sample, evaluated.candidateWindow),
      } satisfies MilkyWaySamplePlan;
    })
  );

  let bestSample: MilkyWaySamplePlan | null = null;
  for (const samplePlan of samples) {
    if (!bestSample || compareSamplePlans(samplePlan, bestSample) > 0) {
      bestSample = samplePlan;
    }
  }

  const coreEvaluation = evaluateVisibility(
    forecast.milkyWay.coreVisibility,
    forecast,
    horizonProfile,
    calculator
  );

  return {
    forecast,
    samples,
    bestSample,
    core: {
      visibility: forecast.milkyWay.coreVisibility,
      accessibility: coreEvaluation.accessibility,
      candidateWindow: coreEvaluation.candidateWindow,
      photoWindow:
        isAstronomicallyDark && transparencyReady && skyglowReady
          ? coreEvaluation.candidateWindow
          : null,
    },
    isAstronomicallyDark,
    transparencyReady,
    skyglowReady,
  };
}
