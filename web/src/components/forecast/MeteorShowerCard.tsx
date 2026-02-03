import { Moon, Star } from 'lucide-react';
import { useState } from 'react';
import { Card, CountBadge, ToggleChevron } from '@/components/ui/Card';
import { getAdjustedHourlyRate, getIAUMeteorShowerInfo } from '@/lib/events/meteor-showers';
import { getAltitudeTextColor, getMoonInterference } from '@/lib/utils/colors';
import { getNightLabel } from '@/lib/utils/format';
import type { MeteorShower } from '@/types';

interface MeteorShowerCardProps {
  showers: MeteorShower[];
  nightDate: Date;
}

export default function MeteorShowerCard({ showers, nightDate }: MeteorShowerCardProps) {
  const [expanded, setExpanded] = useState(false);

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
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-night-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">☄️</span>
          <h3 className="font-semibold text-white">Meteor Showers</h3>
          <CountBadge count={showers.length} />
        </div>
        <ToggleChevron expanded={expanded} />
      </button>

      {/* Primary shower summary (always visible) */}
      <div className="px-4 pb-3 border-b border-night-700">
        <ShowerSummary shower={primaryShower} />
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="p-4 space-y-3">
          {/* Primary shower details */}
          <ShowerDetails shower={primaryShower} nightDate={nightDate} />

          {/* Additional showers */}
          {additionalShowers.length > 0 && (
            <div className="mt-4 pt-4 border-t border-night-700">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Other Active Showers</h4>
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
  const adjustedRate = getAdjustedHourlyRate(shower);

  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-white font-medium">{shower.name}</span>
        <span className="text-gray-500 ml-2">({shower.code})</span>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-gray-400">~{adjustedRate}/hr</span>
        <PeakIndicator daysFromPeak={shower.daysFromPeak} />
      </div>
    </div>
  );
}

interface ShowerDetailsProps {
  shower: MeteorShower;
  nightDate: Date;
}

function ShowerDetails({ shower, nightDate }: ShowerDetailsProps) {
  const adjustedRate = getAdjustedHourlyRate(shower);
  const { constellation } = getIAUMeteorShowerInfo(shower);
  const moonInterference = getMoonInterference(shower.moonIllumination);

  return (
    <div className="bg-night-800 rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-medium text-white">{shower.name}</h4>
          <span className="text-sm text-gray-500">({shower.code})</span>
        </div>
        <PeakBadge daysFromPeak={shower.daysFromPeak} nightDate={nightDate} />
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-gray-500">ZHR: </span>
          <span className="text-white font-medium">~{shower.zhr}/hr</span>
        </div>
        <div>
          <span className="text-gray-500">Velocity: </span>
          <span className="text-gray-300">{shower.velocityKms} km/s</span>
        </div>
        <div className="flex items-center gap-1">
          <Star className="w-3 h-3 text-gray-500" />
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
      <div className="flex items-center gap-2 pt-2 border-t border-night-700">
        <Moon className="w-4 h-4 text-gray-500" />
        <span className="text-sm text-gray-400">
          Moon: {shower.moonIllumination?.toFixed(0) ?? 0}%
        </span>
        {shower.moonSeparationDeg !== null && (
          <span className="text-sm text-gray-500">
            ({shower.moonSeparationDeg.toFixed(0)}° from radiant)
          </span>
        )}
        <span className={`text-sm ml-auto ${moonInterference.textColor}`}>
          {moonInterference.text}
        </span>
      </div>

      {/* Adjusted rate */}
      <div className="flex items-center justify-between pt-2 border-t border-night-700">
        <span className="text-sm text-gray-400">Adjusted rate (conditions):</span>
        <span className="text-lg font-medium text-green-400">~{adjustedRate}/hr</span>
      </div>

      {/* Peak countdown bar */}
      <PeakProgressBar daysFromPeak={shower.daysFromPeak} />

      {/* Parent object */}
      <div className="text-sm text-gray-500 pt-2">Parent: {shower.parentObject}</div>
    </div>
  );
}

interface ShowerCompactProps {
  shower: MeteorShower;
}

function ShowerCompact({ shower }: ShowerCompactProps) {
  const adjustedRate = getAdjustedHourlyRate(shower);
  const { constellation } = getIAUMeteorShowerInfo(shower);

  return (
    <div className="bg-night-800 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium">{shower.name}</span>
          <span className="text-gray-500 text-sm">({shower.code})</span>
        </div>
        <PeakIndicator daysFromPeak={shower.daysFromPeak} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs text-gray-400">
        <div>ZHR: {shower.zhr}/hr</div>
        <div>~{adjustedRate}/hr adjusted</div>
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
      <span className="text-xs text-green-400 bg-green-500/20 px-2 py-0.5 rounded">Peak!</span>
    );
  }

  if (daysFromPeak < 0) {
    return <span className="text-xs text-amber-400">{absDays.toFixed(0)}d past peak</span>;
  }

  return <span className="text-xs text-sky-400">{absDays.toFixed(0)}d to peak</span>;
}

interface PeakBadgeProps {
  daysFromPeak: number | null;
  nightDate: Date;
}

function PeakBadge({ daysFromPeak, nightDate }: PeakBadgeProps) {
  if (daysFromPeak === null) return null;

  const absDays = Math.abs(daysFromPeak);

  if (absDays < 1) {
    return (
      <span className="text-sm bg-green-500/20 text-green-400 px-3 py-1 rounded-full font-medium">
        Peak {getNightLabel(nightDate)}!
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
      <div className="relative h-2 bg-night-700 rounded-full overflow-hidden">
        <div
          className={`absolute h-full ${isPastPeak ? 'bg-amber-500' : 'bg-green-500'} transition-all`}
          style={{ width: `${progress}%` }}
        />
        {/* Peak marker */}
        <div className="absolute right-0 top-0 h-full w-0.5 bg-white" />
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>Start</span>
        <span>Peak</span>
      </div>
    </div>
  );
}
