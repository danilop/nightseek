import {
  Camera,
  Clock3,
  Compass,
  Info,
  Map as MapIcon,
  Moon,
  Mountain,
  Sparkles,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { SkyCalculator } from '@/lib/astronomy/calculator';
import { calculateImagingWindows } from '@/lib/astronomy/imaging-windows';
import { calculateBortle, getBortleColorClass } from '@/lib/lightpollution/bortle';
import { getAltitudeAtTime, getAzimuthAtTime } from '@/lib/utils/altitude-interpolation';
import {
  azimuthToCardinal,
  formatDurationMinutes,
  formatTime,
  formatTimeRange,
  getNightLabel,
} from '@/lib/utils/format';
import { evaluateTargetAccessibility, type TargetAccessibility } from '@/lib/utils/horizon-profile';
import { getBestPhotoReadyWindow, type PhotoReadyWindow } from '@/lib/utils/target-photo-windows';
import type {
  HorizonProfile,
  Location,
  NightForecast,
  ObjectVisibility,
  ScoredObject,
} from '@/types';

interface GalacticCorePlannerCardProps {
  core: ScoredObject;
  forecast: NightForecast;
  forecastRange: NightForecast[];
  horizonProfile: HorizonProfile;
  location: Location;
  onOpenDetails: (object: ScoredObject, accessibility: TargetAccessibility) => void;
  onShowSky: (time: Date) => void;
}

interface CorePlan {
  forecast: NightForecast;
  accessibility: TargetAccessibility;
  qualityWindow: PhotoReadyWindow | null;
  candidateWindow: PhotoReadyWindow | null;
  photoWindow: PhotoReadyWindow | null;
}

interface SkyPoint {
  time: Date;
  altitude: number;
  azimuth: number;
}

function buildCorePlan(
  forecast: NightForecast,
  horizonProfile: HorizonProfile,
  location: Location
): CorePlan {
  const accessibility = evaluateTargetAccessibility(
    forecast.milkyWay,
    horizonProfile,
    forecast.weather
  );
  const calculator = new SkyCalculator(location.latitude, location.longitude);
  const imagingWindows = calculateImagingWindows(
    forecast.milkyWay,
    forecast.nightInfo,
    forecast.weather,
    calculator
  );

  const candidateWindow = getBestPhotoReadyWindow(imagingWindows, accessibility);
  const transparency = forecast.weather?.transparencyScore;
  const transparencyReady =
    transparency === null || transparency === undefined || transparency >= 30;

  return {
    forecast,
    accessibility,
    qualityWindow: imagingWindows[0]
      ? {
          ...imagingWindows[0],
          durationMinutes:
            (imagingWindows[0].end.getTime() - imagingWindows[0].start.getTime()) / 60_000,
        }
      : null,
    candidateWindow,
    photoWindow: transparencyReady ? candidateWindow : null,
  };
}

function getSkyPoint(visibility: ObjectVisibility, time: Date): SkyPoint {
  return {
    time,
    altitude: getAltitudeAtTime(visibility.altitudeSamples, time),
    azimuth: getAzimuthAtTime(visibility.azimuthSamples, time),
  };
}

function getPeakPoint(visibility: ObjectVisibility, window: PhotoReadyWindow): SkyPoint {
  const candidates = [
    getSkyPoint(visibility, window.start),
    getSkyPoint(visibility, window.end),
    ...visibility.altitudeSamples
      .filter(([time]) => time >= window.start && time <= window.end)
      .map(([time]) => getSkyPoint(visibility, time)),
  ];
  return candidates.reduce((best, point) => (point.altitude > best.altitude ? point : best));
}

function getDarknessLabel(forecast: NightForecast): string {
  switch (forecast.nightInfo.observingWindowMode) {
    case 'astronomical':
      return 'Astronomical night';
    case 'nautical':
      return 'Nautical twilight';
    case 'civil':
      return 'Civil twilight';
    case 'sunset':
      return 'After sunset';
    case 'continuous':
      return 'Continuous darkness';
    case 'none':
      return 'No usable darkness';
  }
}

function getTransparencyLabel(forecast: NightForecast): string {
  const score = forecast.weather?.transparencyScore;
  return score === null || score === undefined ? 'No forecast' : `${Math.round(score)}/100`;
}

function getPositionWindowLabel(plan: CorePlan): 'photo' | 'candidate' | 'best conditions' {
  if (plan.photoWindow) return 'photo';
  if (plan.candidateWindow) return 'candidate';
  return 'best conditions';
}

function getStatus(plan: CorePlan): { label: string; detail: string; className: string } {
  if (plan.photoWindow) {
    return {
      label: 'Photo-ready',
      detail: 'Clears your horizon while Moon, weather, altitude, and darkness are acceptable.',
      className: 'border-green-500/30 bg-green-500/15 text-green-300',
    };
  }
  if (plan.forecast.nightInfo.observingWindowMode === 'none') {
    return {
      label: 'No dark-enough window',
      detail: 'The Sun never reaches the app’s usable darkness threshold on this night.',
      className: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
    };
  }
  if (!plan.forecast.milkyWay.isVisible) {
    return {
      label: 'Below the usable night sky',
      detail: 'The core does not rise during this night’s usable darkness window.',
      className: 'border-night-600 bg-night-800 text-gray-300',
    };
  }
  if (!plan.accessibility.isAccessible) {
    return {
      label: 'Blocked by your sky profile',
      detail: 'The core stays below your minimum altitude or a directional obstruction.',
      className: 'border-orange-500/30 bg-orange-500/15 text-orange-300',
    };
  }
  if (plan.qualityWindow && !plan.candidateWindow) {
    return {
      label: 'Blocked during best conditions',
      detail: 'The core clears your sky later, but your profile blocks the useful quality window.',
      className: 'border-orange-500/30 bg-orange-500/15 text-orange-300',
    };
  }
  if (plan.candidateWindow && (plan.forecast.weather?.transparencyScore ?? 100) < 30) {
    return {
      label: 'Poor transparency',
      detail: 'The geometry works, but haze or aerosols are suppressing Milky Way contrast.',
      className: 'border-orange-500/30 bg-orange-500/15 text-orange-300',
    };
  }
  return {
    label: 'Visible, not photo-ready',
    detail:
      'It clears your horizon, but altitude, Moon, or weather stays below the photo threshold.',
    className: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
  };
}

function PositionPoint({
  label,
  point,
  timezone,
}: {
  label: string;
  point: SkyPoint;
  timezone?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-night-700 bg-night-950/50 p-3">
      <div className="text-gray-500 text-xs">{label}</div>
      <div className="mt-1 font-medium text-white">{formatTime(point.time, timezone)}</div>
      <div className="mt-1 text-sky-300 text-xs">
        {Math.round(point.altitude)}° {azimuthToCardinal(point.azimuth)}
        <span className="ml-1 text-gray-500">({Math.round(point.azimuth)}°)</span>
      </div>
    </div>
  );
}

function CitySkyglowWarning({ bortleClass }: { bortleClass: number }) {
  if (bortleClass < 7) return null;
  return (
    <p className="rounded-lg border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-orange-200 text-xs">
      Strong city skyglow will reduce core contrast even in a valid window. A darker site is the
      highest-impact improvement.
    </p>
  );
}

function CorePath({
  visibility,
  window,
  windowLabel,
  timezone,
}: {
  visibility: ObjectVisibility;
  window: PhotoReadyWindow | null;
  windowLabel: 'photo' | 'candidate' | 'best conditions';
  timezone?: string;
}) {
  if (window) {
    const startPoint = getSkyPoint(visibility, window.start);
    const peakPoint = getPeakPoint(visibility, window);
    const endPoint = getSkyPoint(visibility, window.end);
    return (
      <div>
        <div className="mb-2 flex items-center gap-2 text-gray-300 text-sm">
          <Compass className="h-4 w-4 text-sky-400" />
          Where it moves during the {windowLabel} window
        </div>
        <div className="grid grid-cols-3 gap-2">
          <PositionPoint label="Start" point={startPoint} timezone={timezone} />
          <PositionPoint label="Highest" point={peakPoint} timezone={timezone} />
          <PositionPoint label="End" point={endPoint} timezone={timezone} />
        </div>
      </div>
    );
  }
  if (!visibility.maxAltitudeTime) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg bg-night-950/40 p-3 text-sm">
      <Mountain className="h-4 w-4 text-yellow-400" />
      <span className="text-gray-400">Night peak</span>
      <span className="ml-auto text-white">
        {Math.round(visibility.maxAltitude)}° {azimuthToCardinal(visibility.azimuthAtPeak)} at{' '}
        {formatTime(visibility.maxAltitudeTime, timezone)}
      </span>
    </div>
  );
}

export default function GalacticCorePlannerCard({
  core,
  forecast,
  forecastRange,
  horizonProfile,
  location,
  onOpenDetails,
  onShowSky,
}: GalacticCorePlannerCardProps) {
  const plans = useMemo(
    () => forecastRange.map(item => buildCorePlan(item, horizonProfile, location)),
    [forecastRange, horizonProfile, location]
  );
  const plan =
    plans.find(
      item => item.forecast.nightInfo.date.getTime() === forecast.nightInfo.date.getTime()
    ) ?? buildCorePlan(forecast, horizonProfile, location);
  const bestForecastPlan = plans
    .filter(item => item.photoWindow)
    .sort(
      (a, b) =>
        (b.photoWindow?.qualityScore ?? 0) - (a.photoWindow?.qualityScore ?? 0) ||
        (b.photoWindow?.durationMinutes ?? 0) - (a.photoWindow?.durationMinutes ?? 0)
    )[0];
  const status = getStatus(plan);
  const bortle = calculateBortle(location.latitude, location.longitude);
  const timezone = location.timezone;
  const photoWindow = plan.photoWindow;
  const positionWindow = photoWindow ?? plan.candidateWindow ?? plan.qualityWindow;
  const peakPoint = positionWindow ? getPeakPoint(forecast.milkyWay, positionWindow) : null;
  const focusTime = peakPoint?.time ?? forecast.milkyWay.maxAltitudeTime;

  return (
    <section
      aria-labelledby="galactic-core-planner-title"
      className="overflow-hidden rounded-xl border border-indigo-500/30 bg-gradient-to-br from-night-900 via-night-900 to-indigo-950/50"
    >
      <div className="border-night-700 border-b p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="rounded-lg bg-indigo-500/15 p-2.5 text-indigo-300">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-indigo-300 text-xs uppercase tracking-wide">
                Milky Way photography
              </p>
              <h4 id="galactic-core-planner-title" className="font-semibold text-lg text-white">
                Galactic Core planner
              </h4>
              <p className="mt-0.5 text-gray-400 text-sm">Sagittarius A* direction marker</p>
            </div>
          </div>
          <div className={`rounded-full border px-3 py-1 font-medium text-xs ${status.className}`}>
            {status.label}
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {photoWindow ? (
          <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-green-300 text-sm">
                  <Camera className="h-4 w-4" />
                  Best photo window
                </div>
                <div className="mt-1 font-semibold text-2xl text-white">
                  {formatTimeRange(photoWindow.start, photoWindow.end, timezone)}
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium text-green-300">
                  {formatDurationMinutes(photoWindow.durationMinutes)}
                </div>
                <div className="text-gray-500 text-xs">
                  {photoWindow.quality} · {photoWindow.qualityScore}/100
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-night-700 bg-night-950/40 p-4">
            <p className="text-gray-300 text-sm">{status.detail}</p>
            {plan.accessibility.bestWindow ? (
              <p className="mt-2 text-sky-300 text-xs">
                Sky-access window:{' '}
                {formatTimeRange(
                  plan.accessibility.bestWindow.start,
                  plan.accessibility.bestWindow.end,
                  timezone
                )}
              </p>
            ) : null}
            {plan.candidateWindow ? (
              <p className="mt-2 text-amber-300 text-xs">
                Candidate window if conditions improve:{' '}
                {formatTimeRange(plan.candidateWindow.start, plan.candidateWindow.end, timezone)}
              </p>
            ) : null}
            {!plan.candidateWindow && plan.qualityWindow ? (
              <p className="mt-2 text-orange-300 text-xs">
                Best conditions occur at{' '}
                {formatTimeRange(plan.qualityWindow.start, plan.qualityWindow.end, timezone)}, while
                that direction is blocked.
              </p>
            ) : null}
          </div>
        )}

        <CorePath
          visibility={forecast.milkyWay}
          window={positionWindow}
          windowLabel={getPositionWindowLabel(plan)}
          timezone={timezone}
        />

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Condition
            icon={<Moon className="h-4 w-4 text-amber-400" />}
            label="Moonlight"
            value={`${Math.round(forecast.nightInfo.moonlight.exposurePercent)}% exposure`}
          />
          <Condition
            icon={<Clock3 className="h-4 w-4 text-indigo-400" />}
            label="Darkness"
            value={getDarknessLabel(forecast)}
          />
          <Condition
            icon={<Mountain className="h-4 w-4 text-cyan-400" />}
            label="Transparency"
            value={getTransparencyLabel(forecast)}
          />
          <Condition
            icon={<Sparkles className="h-4 w-4 text-violet-400" />}
            label="Skyglow"
            value={`Bortle ${bortle.value}`}
            valueClass={getBortleColorClass(bortle.value)}
          />
        </div>

        <CitySkyglowWarning bortleClass={bortle.value} />

        {bestForecastPlan?.photoWindow ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-night-700 bg-night-950/40 px-3 py-2 text-sm">
            <span className="text-gray-400">Best in this forecast</span>
            <span className="text-white">
              {getNightLabel(bestForecastPlan.forecast.nightInfo.date, false, timezone)} ·{' '}
              {formatTimeRange(
                bestForecastPlan.photoWindow.start,
                bestForecastPlan.photoWindow.end,
                timezone
              )}
            </span>
          </div>
        ) : (
          <p className="text-gray-500 text-xs">
            No photo-ready Galactic Core window appears in the current forecast range.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onOpenDetails(core, plan.accessibility)}
            className="rounded-lg bg-night-800 px-3 py-2 font-medium text-gray-200 text-sm transition-colors hover:bg-night-700"
          >
            More details
          </button>
          <button
            type="button"
            disabled={!focusTime}
            onClick={() => focusTime && onShowSky(focusTime)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <MapIcon className="h-4 w-4" />
            Show on sky map
          </button>
        </div>

        <div className="flex gap-2 border-night-700 border-t pt-3 text-gray-500 text-xs">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
          <p>
            No single magnitude usefully describes the Milky Way core: it is extended glow, not a
            point source. Apparent contrast varies with altitude, atmospheric transparency, skyglow,
            and Moonlight, so the planner scores those conditions directly.
          </p>
        </div>
      </div>
    </section>
  );
}

function Condition({
  icon,
  label,
  value,
  valueClass = 'text-white',
}: {
  icon: ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg border border-night-700 bg-night-950/40 p-3">
      <div className="flex items-center gap-1.5 text-gray-500 text-xs">
        {icon}
        {label}
      </div>
      <div className={`mt-1 font-medium text-sm ${valueClass}`}>{value}</div>
    </div>
  );
}
