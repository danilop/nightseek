import { Camera, Clock3, Compass, Info, Map as MapIcon, Moon, Mountain } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import SectionCard from '@/components/ui/SectionCard';
import { useUIState } from '@/hooks/useUIState';
import { SkyCalculator } from '@/lib/astronomy/calculator';
import {
  buildMilkyWayNightPlan,
  type MilkyWayNightPlan,
  type MilkyWaySamplePlan,
} from '@/lib/astronomy/milky-way-planning';
import { estimateBortle } from '@/lib/lightpollution/bortle-estimate';
import { isSkyglowFavourable } from '@/lib/lightpollution/sky-brightness';
import { useSkyBrightness } from '@/lib/lightpollution/useSkyBrightness';
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

const CATEGORY_KEY = 'milky_way';

interface MilkyWayPlannerCardProps {
  target: ScoredObject;
  forecast: NightForecast;
  forecastRange: NightForecast[];
  horizonProfile: HorizonProfile;
  location: Location;
  defaultExpanded?: boolean;
  isDragging?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
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
  if (!plan.skyglowKnown) {
    return {
      label: 'Skyglow not checked',
      detail: 'Position and weather are available, but sky-brightness data is missing.',
      className: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
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

function getCollapsedPreview(
  best: MilkyWaySamplePlan | null,
  statusLabel: string,
  timezone?: string
): string {
  if (!best) return statusLabel;
  const window = best.photoWindow ?? best.candidateWindow;
  if (window) {
    return `${best.section.label} · ${formatTimeRange(window.start, window.end, timezone)}`;
  }
  return `${best.section.label} · ${statusLabel}`;
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

function CitySkyglowWarning({ skyBrightness }: { skyBrightness: number | null }) {
  if (skyBrightness === null || isSkyglowFavourable(skyBrightness)) return null;
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
        <div className="mb-2 flex items-center gap-2 text-gray-400 text-xs">
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

function BestSectionSummary({ best }: { best: MilkyWaySamplePlan }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-indigo-400/20 bg-indigo-400/10 p-3">
      <div className="min-w-0">
        <p className="text-indigo-200/70 text-xs">Best section</p>
        <p className="font-semibold text-white">{best.section.label}</p>
        <p className="mt-0.5 max-w-xl text-gray-400 text-xs">{best.section.description}</p>
      </div>
      <span className="shrink-0 rounded-full bg-night-950/50 px-2 py-0.5 text-indigo-200 text-xs">
        {getProminenceLabel(best.section.relativeProminence)}
      </span>
    </div>
  );
}

function WindowSummary({
  best,
  statusDetail,
  timezone,
}: {
  best: MilkyWaySamplePlan | null;
  statusDetail: string;
  timezone?: string;
}) {
  if (best?.photoWindow) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-green-500/20 bg-green-500/10 p-3">
        <div className="flex items-center gap-2 text-green-300 text-sm">
          <Camera className="h-4 w-4" />
          Best photo window
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-lg text-white">
            {formatTimeRange(best.photoWindow.start, best.photoWindow.end, timezone)}
          </span>
          <span className="text-gray-500 text-xs">
            {formatDurationMinutes(best.photoWindow.durationMinutes)} · {best.photoWindow.quality}{' '}
            {best.photoWindow.qualityScore}/100
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-night-700 bg-night-950/40 p-3">
      <p className="text-gray-300 text-sm">{statusDetail}</p>
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
  );
}

/** Conditions, Galactic Core, and forecast context — hidden until asked for. */
function PlanningDetails({
  plan,
  forecast,
  bestForecastPlan,
  skyBrightness,
  timezone,
}: {
  plan: MilkyWayNightPlan;
  forecast: NightForecast;
  bestForecastPlan: MilkyWayNightPlan | undefined;
  skyBrightness: number | null;
  timezone?: string;
}) {
  const bestForecastSample = bestForecastPlan?.bestSample;
  const bortleEstimate = estimateBortle(skyBrightness);

  return (
    <div className="space-y-3 border-night-700 border-t pt-3">
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
          icon={<span className="text-xs">🌌</span>}
          label="Estimated sky brightness"
          value={
            skyBrightness === null || bortleEstimate === null
              ? 'Unavailable'
              : `Bortle ${bortleEstimate.toFixed(1)} est. · ${skyBrightness.toFixed(1)} mag/arcsec²`
          }
          valueClass="text-sky-300"
        />
      </div>

      <CitySkyglowWarning skyBrightness={skyBrightness} />
      <GalacticCoreSummary plan={plan} timezone={timezone} />

      {bestForecastPlan && bestForecastSample?.photoWindow ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-night-700 bg-night-950/40 px-3 py-2 text-sm">
          <span className="text-gray-400">Best in this forecast</span>
          <span className="text-white">
            {getNightLabel(bestForecastPlan.forecast.nightInfo.date, false, timezone)} ·{' '}
            {bestForecastSample.section.label} ·{' '}
            {formatTimeRange(
              bestForecastSample.photoWindow.start,
              bestForecastSample.photoWindow.end,
              timezone
            )}
          </span>
        </div>
      ) : (
        <p className="text-gray-500 text-xs">
          No photo-ready Milky Way window appears in the current forecast range.
        </p>
      )}

      <div className="flex gap-2 text-gray-500 text-xs">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
        <p>
          The Milky Way has no single useful magnitude: it is an extended, uneven band. Relative
          prominence describes its structure; photo readiness is calculated from astronomical
          darkness, Moon position and phase, weather, altitude, skyglow, and your directional
          obstructions.
        </p>
      </div>
    </div>
  );
}

export default function MilkyWayPlannerCard({
  target,
  forecast,
  forecastRange,
  horizonProfile,
  location,
  defaultExpanded = true,
  isDragging,
  dragHandleProps,
  onOpenDetails,
  onShowSky,
}: MilkyWayPlannerCardProps) {
  const { isCategoryExpanded, toggleCategoryExpanded } = useUIState();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const expanded = isCategoryExpanded(CATEGORY_KEY, defaultExpanded);
  const { data: sky } = useSkyBrightness(location.latitude, location.longitude);
  const skyBrightness = sky?.magnitudes ?? null;
  const plans = useMemo(() => {
    const calculator = new SkyCalculator(location.latitude, location.longitude);
    return forecastRange.map(item =>
      buildMilkyWayNightPlan(item, horizonProfile, calculator, skyBrightness)
    );
  }, [forecastRange, horizonProfile, location.latitude, location.longitude, skyBrightness]);
  const plan =
    plans.find(
      item => item.forecast.nightInfo.date.getTime() === forecast.nightInfo.date.getTime()
    ) ??
    buildMilkyWayNightPlan(
      forecast,
      horizonProfile,
      new SkyCalculator(location.latitude, location.longitude),
      skyBrightness
    );
  const best = plan.bestSample;
  const status = getStatus(plan);
  const timezone = location.timezone;
  const positionWindow = best
    ? (best.photoWindow ?? best.candidateWindow ?? best.qualityWindow)
    : null;
  const visibility = best?.sample.visibility;
  const peakPoint = visibility && positionWindow ? getPeakPoint(visibility, positionWindow) : null;
  const focusTime = peakPoint?.time ?? visibility?.maxAltitudeTime;
  const canShowSky = Boolean(focusTime && visibility && best);

  const handleShowSky = () => {
    if (!focusTime || !visibility || !best) return;
    onShowSky({
      time: focusTime,
      raHours: visibility.raHours,
      decDegrees: visibility.decDegrees,
      label: best.section.label,
    });
  };

  return (
    <SectionCard
      icon="🌌"
      title="Milky Way"
      titleId="milky-way-planner-title"
      badge={
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 font-medium text-xs ${status.className}`}
        >
          {status.label}
        </span>
      }
      preview={getCollapsedPreview(best, status.label, timezone)}
      expanded={expanded}
      onToggle={() => toggleCategoryExpanded(CATEGORY_KEY)}
      dragHandleProps={dragHandleProps}
      isDragging={isDragging}
      bodyClassName="space-y-3 p-4"
    >
      {best ? <BestSectionSummary best={best} /> : null}

      <WindowSummary best={best} statusDetail={status.detail} timezone={timezone} />

      {visibility && best ? (
        <BandPath
          visibility={visibility}
          window={positionWindow}
          windowLabel={getPositionWindowLabel(best)}
          timezone={timezone}
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!best}
          onClick={() =>
            best && onOpenDetails(createSelectedTarget(target, best), best.accessibility)
          }
          className="rounded-lg bg-night-800 px-3 py-2 font-medium text-gray-200 text-sm transition-colors hover:bg-night-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          More details
        </button>
        <button
          type="button"
          disabled={!canShowSky}
          onClick={handleShowSky}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <MapIcon className="h-4 w-4" />
          Show on sky map
        </button>
      </div>

      <button
        type="button"
        onClick={() => setDetailsOpen(!detailsOpen)}
        className="w-full rounded-lg py-2 text-sky-400 text-sm transition-colors hover:bg-night-800 hover:text-sky-300"
      >
        {detailsOpen ? 'Hide conditions and core' : 'Show conditions and core'}
      </button>

      {detailsOpen && (
        <PlanningDetails
          plan={plan}
          forecast={forecast}
          bestForecastPlan={getBestForecastPlan(plans)}
          skyBrightness={skyBrightness}
          timezone={timezone}
        />
      )}
    </SectionCard>
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
