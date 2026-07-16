import { Moon, Star } from 'lucide-react';
import { useState } from 'react';
import { Card, CountBadge, ToggleChevron } from '@/components/ui/Card';
import { getGeometricHourlyRateCeiling, getIAUMeteorShowerInfo } from '@/lib/events/meteor-showers';
import { getAltitudeTextColor, getMoonInterference } from '@/lib/utils/colors';
import { getNightLabel } from '@/lib/utils/format';
import { useApp } from '@/stores/AppContext';
import type { MeteorShower } from '@/types';

interface MeteorShowerCardProps {
  showers: MeteorShower[];
  nightDate: Date;
}

export default function MeteorShowerCard({ showers, nightDate }: MeteorShowerCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { state } = useApp();
  const timezone = state.location?.timezone;

  if (showers.length === 0) {
    return null;
  }

  // Get the most active shower (highest ZHR)
  const primaryShower = showers[0];
  const additionalShowers = showers.slice(1);

  return (
    <Card>
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-night-800"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">☄️</span>
          <h3 className="font-semibold text-white">Meteor Showers</h3>
          <CountBadge count={showers.length} />
        </div>
        <ToggleChevron expanded={expanded} />
      </button>

      {/* Primary shower summary (always visible) */}
      <div className="border-night-700 border-b px-4 pb-3">
        <ShowerSummary shower={primaryShower} />
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="space-y-3 p-4">
          {/* Primary shower details */}
          <ShowerDetails shower={primaryShower} nightDate={nightDate} timezone={timezone} />

          {/* Additional showers */}
          {additionalShowers.length > 0 && (
            <div className="mt-4 border-night-700 border-t pt-4">
              <h4 className="mb-3 font-medium text-gray-400 text-sm">Other Active Showers</h4>
              <div className="space-y-3">
                {additionalShowers.map(shower => (
                  <ShowerCompact key={shower.code} shower={shower} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

interface ShowerSummaryProps {
  shower: MeteorShower;
}

function ShowerSummary({ shower }: ShowerSummaryProps) {
  const geometricCeiling = getGeometricHourlyRateCeiling(shower);

  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="font-medium text-white">{shower.name}</span>
        <span className="ml-2 text-gray-500">({shower.code})</span>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-gray-400">≤{geometricCeiling}/hr geometry</span>
        <PeakIndicator daysFromPeak={shower.daysFromPeak} />
      </div>
    </div>
  );
}

interface ShowerDetailsProps {
  shower: MeteorShower;
  nightDate: Date;
  timezone?: string;
}

function ShowerDetails({ shower, nightDate, timezone }: ShowerDetailsProps) {
  const geometricCeiling = getGeometricHourlyRateCeiling(shower);
  const { constellation } = getIAUMeteorShowerInfo(shower);
  const moonInterference =
    shower.moonAltitudeDeg !== null && shower.moonAltitudeDeg <= 0
      ? { text: 'No interference', textColor: 'text-green-400' }
      : getMoonInterference(shower.moonIllumination);

  return (
    <div className="space-y-3 rounded-lg bg-night-800 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium text-lg text-white">{shower.name}</h4>
          <span className="text-gray-500 text-sm">({shower.code})</span>
        </div>
        <PeakBadge daysFromPeak={shower.daysFromPeak} nightDate={nightDate} timezone={timezone} />
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-gray-500">Published peak ZHR: </span>
          <span className="font-medium text-white">~{shower.zhr}/hr</span>
        </div>
        <div>
          <span className="text-gray-500">Velocity: </span>
          <span className="text-gray-300">{shower.velocityKms} km/s</span>
        </div>
        <div className="flex items-center gap-1">
          <Star className="h-3 w-3 text-gray-500" />
          <span className="text-gray-500">Radiant: </span>
          <span className="text-gray-300">{constellation}</span>
        </div>
        <div>
          <span className="text-gray-500">Altitude: </span>
          <span className={getAltitudeTextColor(shower.radiantAltitude ?? -1)}>
            {shower.radiantAltitude !== null
              ? `${shower.radiantAltitude.toFixed(0)}° at midnight`
              : 'Below horizon'}
          </span>
        </div>
      </div>

      {/* Moon interference */}
      <div className="flex items-center gap-2 border-night-700 border-t pt-2">
        <Moon className="h-4 w-4 text-gray-500" />
        <span className="text-gray-400 text-sm">
          {shower.moonAltitudeDeg !== null && shower.moonAltitudeDeg <= 0
            ? `Moon below horizon (${shower.moonIllumination?.toFixed(0) ?? 0}% illuminated)`
            : `Moon: ${shower.moonIllumination?.toFixed(0) ?? 0}%`}
        </span>
        {shower.moonAltitudeDeg !== null &&
          shower.moonAltitudeDeg > 0 &&
          shower.moonSeparationDeg !== null && (
            <span className="text-gray-500 text-sm">
              ({shower.moonSeparationDeg.toFixed(0)}° from radiant)
            </span>
          )}
        <span className={`ml-auto text-sm ${moonInterference.textColor}`}>
          {moonInterference.text}
        </span>
      </div>

      {/* Geometric ceiling */}
      <div className="flex items-center justify-between border-night-700 border-t pt-2">
        <span className="text-gray-400 text-sm">At-peak geometric ceiling:</span>
        <span className="font-medium text-green-400 text-lg">≤{geometricCeiling}/hr</span>
      </div>
      <p className="text-gray-500 text-xs">
        Not a personal rate forecast; sky darkness, limiting magnitude, and the shower activity
        profile can reduce the observed count.
      </p>

      {/* Peak countdown bar */}
      <PeakProgressBar daysFromPeak={shower.daysFromPeak} />

      {/* Parent object */}
      <div className="pt-2 text-gray-500 text-sm">Parent: {shower.parentObject}</div>
    </div>
  );
}

interface ShowerCompactProps {
  shower: MeteorShower;
}

function ShowerCompact({ shower }: ShowerCompactProps) {
  const geometricCeiling = getGeometricHourlyRateCeiling(shower);
  const { constellation } = getIAUMeteorShowerInfo(shower);

  return (
    <div className="rounded-lg bg-night-800 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white">{shower.name}</span>
          <span className="text-gray-500 text-sm">({shower.code})</span>
        </div>
        <PeakIndicator daysFromPeak={shower.daysFromPeak} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-gray-400 text-xs">
        <div>Peak ZHR: {shower.zhr}/hr</div>
        <div>≤{geometricCeiling}/hr geometry</div>
        <div>{constellation}</div>
      </div>
    </div>
  );
}

interface PeakIndicatorProps {
  daysFromPeak: number | null;
}

function PeakIndicator({ daysFromPeak }: PeakIndicatorProps) {
  if (daysFromPeak === null) return null;

  const absDays = Math.abs(daysFromPeak);

  if (absDays < 1) {
    return (
      <span className="rounded bg-green-500/20 px-2 py-0.5 text-green-400 text-xs">Peak!</span>
    );
  }

  if (daysFromPeak < 0) {
    return <span className="text-amber-400 text-xs">{absDays.toFixed(0)}d past peak</span>;
  }

  return <span className="text-sky-400 text-xs">{absDays.toFixed(0)}d to peak</span>;
}

interface PeakBadgeProps {
  daysFromPeak: number | null;
  nightDate: Date;
  timezone?: string;
}

function PeakBadge({ daysFromPeak, nightDate, timezone }: PeakBadgeProps) {
  if (daysFromPeak === null) return null;

  const absDays = Math.abs(daysFromPeak);

  if (absDays < 1) {
    return (
      <span className="rounded-full bg-green-500/20 px-3 py-1 font-medium text-green-400 text-sm">
        Peak {getNightLabel(nightDate, false, timezone)}!
      </span>
    );
  }

  return null;
}

interface PeakProgressBarProps {
  daysFromPeak: number | null;
}

function PeakProgressBar({ daysFromPeak }: PeakProgressBarProps) {
  if (daysFromPeak === null) return null;

  // Calculate progress (0 = 10 days before, 100 = peak, 200 = 10 days after)
  const progress = Math.max(0, Math.min(100, 50 + (daysFromPeak / 10) * -50));
  const isPastPeak = daysFromPeak > 0;

  return (
    <div className="pt-2">
      <div className="relative h-2 overflow-hidden rounded-full bg-night-700">
        <div
          className={`absolute h-full ${isPastPeak ? 'bg-amber-500' : 'bg-green-500'} transition-all`}
          style={{ width: `${progress}%` }}
        />
        {/* Peak marker */}
        <div className="absolute top-0 right-0 h-full w-0.5 bg-white" />
      </div>
      <div className="mt-1 flex justify-between text-gray-500 text-xs">
        <span>Start</span>
        <span>Peak</span>
      </div>
    </div>
  );
}
