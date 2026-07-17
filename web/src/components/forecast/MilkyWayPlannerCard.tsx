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
import {
  buildMilkyWayNightPlan,
  type MilkyWayNightPlan,
  type MilkyWaySamplePlan,
} from '@/lib/astronomy/milky-way-planning';
import { calculateBortle, getBortleColorClass } from '@/lib/lightpollution/bortle';
import { getAltitudeAtTime, getAzimuthAtTime } from '@/lib/utils/altitude-interpolation';
import {
  azimuthToCardinal,
  formatDurationMinutes,
  formatTime,
  formatTimeRange,
  getNightLabel,
} from '@/lib/utils/format';
import type { TargetAccessibility } from '@/lib/utils/horizon-profile';
import type { PhotoReadyWindow } from '@/lib/utils/target-photo-windows';
import type {
  HorizonProfile,
  Location,
  NightForecast,
  ObjectVisibility,
  ScoredObject,
  SkyMapFocus,
} from '@/types';

interface MilkyWayPlannerCardProps {
  target: ScoredObject;
  forecast: NightForecast;
  forecastRange: NightForecast[];
  horizonProfile: HorizonProfile;
  location: Location;
  onOpenDetails: (object: ScoredObject, accessibility: TargetAccessibility) => void;
  onShowSky: (focus: SkyMapFocus) => void;
}

interface SkyPoint {
  time: Date;
  altitude: number;
  azimuth: number;
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

function getPositionWindowLabel(
  samplePlan: MilkyWaySamplePlan
): 'photo' | 'candidate' | 'best conditions' {
  if (samplePlan.photoWindow) return 'photo';
  if (samplePlan.candidateWindow) return 'candidate';
  return 'best conditions';
}

function getStatus(plan: MilkyWayNightPlan): {
  label: string;
  detail: string;
  className: string;
} {
  const best = plan.bestSample;
  if (best?.photoWindow) {
    return {
      label: 'Photo-ready',
      detail: `${best.section.label} has the strongest accessible window tonight.`,
      className: 'border-green-500/30 bg-green-500/15 text-green-300',
    };
  }
  if (!plan.isAstronomicallyDark) {
    return {
      label: 'No astronomical darkness',
      detail:
        'The band may be above your horizon, but the Sun never reaches 18° below it during this night.',
      className: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
    };
  }
  if (!best || !plan.samples.some(sample => sample.sample.visibility.isVisible)) {
    return {
      label: 'Below the usable night sky',
      detail: 'No sampled Milky Way region rises during the usable dark window.',
      className: 'border-night-600 bg-night-800 text-gray-300',
    };
  }
  if (!plan.samples.some(sample => sample.accessibility.isAccessible)) {
    return {
      label: 'Blocked by your sky profile',
      detail: 'The visible band stays below your minimum altitude or directional obstructions.',
      className: 'border-orange-500/30 bg-orange-500/15 text-orange-300',
    };
  }
  if (!plan.transparencyReady) {
    return {
      label: 'Poor transparency',
      detail: 'The geometry works, but haze or aerosols will suppress the band’s contrast.',
      className: 'border-orange-500/30 bg-orange-500/15 text-orange-300',
    };
  }
  if (!plan.skyglowReady) {
    return {
      label: 'Low contrast from skyglow',
      detail:
        'The band is geometrically available, but city skyglow makes a darker site advisable.',
      className: 'border-orange-500/30 bg-orange-500/15 text-orange-300',
    };
  }
  return {
    label: 'Visible, not photo-ready',
    detail:
      'A section clears your horizon, but altitude, Moon, or weather misses the photo threshold.',
    className: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
  };
}

function getProminenceLabel(prominence: number): string {
  if (prominence >= 0.9) return 'Very prominent';
  if (prominence >= 0.7) return 'Prominent';
  if (prominence >= 0.5) return 'Subtle';
  return 'Very subtle';
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
      Strong city skyglow will reduce band contrast even when its position is favourable. A darker
      site is the highest-impact improvement.
    </p>
  );
}

function BandPath({
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
    return (
      <div>
        <div className="mb-2 flex items-center gap-2 text-gray-300 text-sm">
          <Compass className="h-4 w-4 text-sky-400" />
          Where this section moves during the {windowLabel} window
        </div>
        <div className="grid grid-cols-3 gap-2">
          <PositionPoint
            label="Start"
            point={getSkyPoint(visibility, window.start)}
            timezone={timezone}
          />
          <PositionPoint
            label="Highest"
            point={getPeakPoint(visibility, window)}
            timezone={timezone}
          />
          <PositionPoint
            label="End"
            point={getSkyPoint(visibility, window.end)}
            timezone={timezone}
          />
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

function GalacticCoreSummary({ plan, timezone }: { plan: MilkyWayNightPlan; timezone?: string }) {
  const core = plan.core;
  let value = 'Not available tonight';
  let detail = 'The core stays below the usable night sky.';

  if (core.photoWindow) {
    value = formatTimeRange(core.photoWindow.start, core.photoWindow.end, timezone);
    detail = 'The core is also photo-ready during this interval.';
  } else if (!core.accessibility.isAccessible && core.visibility.isVisible) {
    value = 'Blocked by sky profile';
    detail = 'It does not clear your height or directional obstruction settings.';
  } else if (!plan.isAstronomicallyDark && core.visibility.isVisible) {
    value = 'Above horizon in twilight';
    detail = 'The core rises, but there is no astronomical darkness for useful contrast.';
  } else if (core.candidateWindow) {
    value = 'Visible, conditions limited';
    detail = 'Its position works, but transparency, skyglow, or darkness is limiting contrast.';
  } else if (core.visibility.isVisible) {
    value = 'Visible, no photo window';
    detail = 'It rises, but Moon, weather, altitude, or duration misses the photo threshold.';
  }

  return (
    <div className="rounded-lg border border-night-700 bg-night-950/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-gray-200 text-sm">Galactic Core</p>
          <p className="mt-0.5 text-gray-500 text-xs">Secondary feature within the Milky Way</p>
        </div>
        <span className="font-medium text-sky-300 text-sm">{value}</span>
      </div>
      <p className="mt-2 text-gray-400 text-xs">{detail}</p>
    </div>
  );
}

function getBestForecastPlan(plans: MilkyWayNightPlan[]): MilkyWayNightPlan | undefined {
  return plans
    .filter(item => item.bestSample?.photoWindow)
    .sort(
      (a, b) =>
        (b.bestSample?.planningScore ?? 0) - (a.bestSample?.planningScore ?? 0) ||
        (b.bestSample?.photoWindow?.durationMinutes ?? 0) -
          (a.bestSample?.photoWindow?.durationMinutes ?? 0)
    )[0];
}

function createSelectedTarget(target: ScoredObject, best: MilkyWaySamplePlan | null): ScoredObject {
  if (!best) return target;
  return {
    ...target,
    objectName: 'Milky Way',
    magnitude: null,
    visibility: best.sample.visibility,
  };
}

export default function MilkyWayPlannerCard({
  target,
  forecast,
  forecastRange,
  horizonProfile,
  location,
  onOpenDetails,
  onShowSky,
}: MilkyWayPlannerCardProps) {
  const bortle = calculateBortle(location.latitude, location.longitude);
  const plans = useMemo(() => {
    const calculator = new SkyCalculator(location.latitude, location.longitude);
    return forecastRange.map(item =>
      buildMilkyWayNightPlan(item, horizonProfile, calculator, bortle.value)
    );
  }, [forecastRange, horizonProfile, location.latitude, location.longitude, bortle.value]);
  const plan =
    plans.find(
      item => item.forecast.nightInfo.date.getTime() === forecast.nightInfo.date.getTime()
    ) ??
    buildMilkyWayNightPlan(
      forecast,
      horizonProfile,
      new SkyCalculator(location.latitude, location.longitude),
      bortle.value
    );
  const bestForecastPlan = getBestForecastPlan(plans);
  const best = plan.bestSample;
  const status = getStatus(plan);
  const timezone = location.timezone;
  const positionWindow = best
    ? (best.photoWindow ?? best.candidateWindow ?? best.qualityWindow)
    : null;
  const visibility = best?.sample.visibility;
  const peakPoint = visibility && positionWindow ? getPeakPoint(visibility, positionWindow) : null;
  const focusTime = peakPoint?.time ?? visibility?.maxAltitudeTime;
  const selectedTarget = createSelectedTarget(target, best);

  return (
    <section
      aria-labelledby="milky-way-planner-title"
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
                Extended band and arch
              </p>
              <h4 id="milky-way-planner-title" className="font-semibold text-lg text-white">
                Milky Way Planner
              </h4>
              <p className="mt-0.5 text-gray-400 text-sm">
                Best visible section, direction, and photo window
              </p>
            </div>
          </div>
          <div className={`rounded-full border px-3 py-1 font-medium text-xs ${status.className}`}>
            {status.label}
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {best ? (
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-indigo-400/20 bg-indigo-400/10 p-4">
            <div>
              <p className="text-indigo-200 text-xs uppercase tracking-wide">Best section</p>
              <p className="mt-1 font-semibold text-white text-xl">{best.section.label}</p>
              <p className="mt-1 max-w-xl text-gray-400 text-sm">{best.section.description}</p>
            </div>
            <div className="rounded-full bg-night-950/50 px-3 py-1.5 text-indigo-200 text-xs">
              {getProminenceLabel(best.section.relativeProminence)}
            </div>
          </div>
        ) : null}

        {best?.photoWindow ? (
          <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-green-300 text-sm">
                  <Camera className="h-4 w-4" />
                  Best photo window
                </div>
                <div className="mt-1 font-semibold text-2xl text-white">
                  {formatTimeRange(best.photoWindow.start, best.photoWindow.end, timezone)}
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium text-green-300">
                  {formatDurationMinutes(best.photoWindow.durationMinutes)}
                </div>
                <div className="text-gray-500 text-xs">
                  {best.photoWindow.quality} · {best.photoWindow.qualityScore}/100
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-night-700 bg-night-950/40 p-4">
            <p className="text-gray-300 text-sm">{status.detail}</p>
            {best?.accessibility.bestWindow ? (
              <p className="mt-2 text-sky-300 text-xs">
                Sky-access window:{' '}
                {formatTimeRange(
                  best.accessibility.bestWindow.start,
                  best.accessibility.bestWindow.end,
                  timezone
                )}
              </p>
            ) : null}
            {best?.candidateWindow ? (
              <p className="mt-2 text-amber-300 text-xs">
                Geometry + Moon/cloud window:{' '}
                {formatTimeRange(best.candidateWindow.start, best.candidateWindow.end, timezone)}
              </p>
            ) : null}
          </div>
        )}

        {visibility ? (
          <BandPath
            visibility={visibility}
            window={positionWindow}
            windowLabel={getPositionWindowLabel(best)}
            timezone={timezone}
          />
        ) : null}

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
        <GalacticCoreSummary plan={plan} timezone={timezone} />

        {bestForecastPlan?.bestSample?.photoWindow ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-night-700 bg-night-950/40 px-3 py-2 text-sm">
            <span className="text-gray-400">Best in this forecast</span>
            <span className="text-white">
              {getNightLabel(bestForecastPlan.forecast.nightInfo.date, false, timezone)} ·{' '}
              {bestForecastPlan.bestSample.section.label} ·{' '}
              {formatTimeRange(
                bestForecastPlan.bestSample.photoWindow.start,
                bestForecastPlan.bestSample.photoWindow.end,
                timezone
              )}
            </span>
          </div>
        ) : (
          <p className="text-gray-500 text-xs">
            No photo-ready Milky Way window appears in the current forecast range.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!best}
            onClick={() => best && onOpenDetails(selectedTarget, best.accessibility)}
            className="rounded-lg bg-night-800 px-3 py-2 font-medium text-gray-200 text-sm transition-colors hover:bg-night-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            More details
          </button>
          <button
            type="button"
            disabled={!focusTime || !visibility || !best}
            onClick={() =>
              focusTime &&
              visibility &&
              best &&
              onShowSky({
                time: focusTime,
                raHours: visibility.raHours,
                decDegrees: visibility.decDegrees,
                label: best.section.label,
              })
            }
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <MapIcon className="h-4 w-4" />
            Show Milky Way on sky map
          </button>
        </div>

        <div className="flex gap-2 border-night-700 border-t pt-3 text-gray-500 text-xs">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
          <p>
            The Milky Way has no single useful magnitude: it is an extended, uneven band. Relative
            prominence describes its structure; photo readiness is calculated from astronomical
            darkness, Moon position and phase, weather, altitude, skyglow, and your directional
            obstructions.
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
