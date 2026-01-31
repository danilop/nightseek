import { Camera, ChevronDown, ChevronUp, Clock, Compass, Moon, Mountain } from 'lucide-react';
import { useState } from 'react';
import { formatImagingWindow } from '@/lib/astronomy/imaging-windows';
import { getScoreTier, getTierDisplay } from '@/lib/scoring';
import {
  formatAltitude,
  formatMagnitude,
  formatMoonSeparation,
  formatTime,
  getAltitudeQualityClass,
  getCategoryIcon,
  getStarRating,
} from '@/lib/utils/format';
import type { NightInfo, NightWeather, ScoredObject } from '@/types';

interface ObjectCardProps {
  object: ScoredObject;
  nightInfo: NightInfo;
  weather: NightWeather | null;
  compact?: boolean;
}

export default function ObjectCard({
  object,
  nightInfo: _nightInfo,
  weather: _weather,
  compact = false,
}: ObjectCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { visibility, scoreBreakdown, totalScore, category, subtype, magnitude } = object;

  const tier = getScoreTier(totalScore);
  const tierDisplay = getTierDisplay(tier);
  const icon = getCategoryIcon(category, subtype);

  if (compact) {
    return (
      <div
        role="button"
        tabIndex={0}
        className="bg-night-800 rounded-lg p-3 cursor-pointer card-hover"
        onClick={() => setExpanded(!expanded)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="text-white font-medium truncate">
                {visibility.commonName || visibility.objectName}
              </h4>
              <span className={`text-sm font-medium ${tierDisplay.color}`}>{totalScore}/200</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
              <span className={getAltitudeQualityClass(visibility.maxAltitude)}>
                {formatAltitude(visibility.maxAltitude)}
              </span>
              {visibility.maxAltitudeTime && (
                <span>@ {formatTime(visibility.maxAltitudeTime)}</span>
              )}
              {magnitude !== null && <span>mag {formatMagnitude(magnitude)}</span>}
            </div>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-night-700 space-y-2">
            <ScoreDetails breakdown={scoreBreakdown} />
            <ObjectDetails visibility={visibility} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-night-800 rounded-lg p-4 card-hover">
      <div className="flex items-start gap-3">
        <span className="text-3xl">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-sm font-medium ${tierDisplay.color}`}>
              {getStarRating(tierDisplay.stars)}
            </span>
          </div>
          <h4 className="text-white font-medium">
            {visibility.commonName || visibility.objectName}
          </h4>
          {visibility.commonName && visibility.commonName !== visibility.objectName && (
            <p className="text-xs text-gray-500">{visibility.objectName}</p>
          )}
        </div>
        <div className="text-right">
          <div className={`text-lg font-bold ${tierDisplay.color}`}>{totalScore}</div>
          <div className="text-xs text-gray-500">/200</div>
        </div>
      </div>

      <div className="mt-3 space-y-2 text-sm">
        <div className="flex items-center gap-2 text-gray-400">
          <Mountain className="w-4 h-4" />
          <span className={getAltitudeQualityClass(visibility.maxAltitude)}>
            {formatAltitude(visibility.maxAltitude)} peak
          </span>
          {visibility.maxAltitudeTime && (
            <span className="text-gray-500">@ {formatTime(visibility.maxAltitudeTime)}</span>
          )}
        </div>

        {visibility.moonSeparation !== null && (
          <div className="flex items-center gap-2 text-gray-400">
            <Moon className="w-4 h-4" />
            <span className={visibility.moonWarning ? 'text-amber-400' : ''}>
              {formatMoonSeparation(visibility.moonSeparation)}
            </span>
          </div>
        )}

        {(visibility.above45Start || visibility.above60Start) && (
          <div className="flex items-center gap-2 text-gray-400">
            <Clock className="w-4 h-4" />
            <span>
              {visibility.above60Start && visibility.above60End
                ? `Above 60°: ${formatTime(visibility.above60Start)} - ${formatTime(visibility.above60End)}`
                : visibility.above45Start && visibility.above45End
                  ? `Above 45°: ${formatTime(visibility.above45Start)} - ${formatTime(visibility.above45End)}`
                  : 'Brief visibility window'}
            </span>
          </div>
        )}
      </div>

      {/* Imaging Window */}
      {visibility.imagingWindow && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          <Camera className="w-4 h-4 text-green-400" />
          <span className="text-gray-400">Best Window:</span>
          <span
            className={`font-medium ${
              visibility.imagingWindow.quality === 'excellent'
                ? 'text-green-400'
                : visibility.imagingWindow.quality === 'good'
                  ? 'text-blue-400'
                  : visibility.imagingWindow.quality === 'acceptable'
                    ? 'text-yellow-400'
                    : 'text-gray-400'
            }`}
          >
            {formatImagingWindow(visibility.imagingWindow)}
          </span>
        </div>
      )}

      {/* Meridian Transit */}
      {visibility.meridianTransitTime && (
        <div className="mt-2 flex items-center gap-2 text-sm">
          <Compass className="w-4 h-4 text-indigo-400" />
          <span className="text-gray-400">Meridian:</span>
          <span className="text-gray-300">{formatTime(visibility.meridianTransitTime)}</span>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-night-700 flex flex-wrap gap-2">
        {magnitude !== null && (
          <span className="px-2 py-1 bg-night-700 rounded text-xs text-gray-300">
            mag {formatMagnitude(magnitude)}
          </span>
        )}
        {subtype && (
          <span className="px-2 py-1 bg-night-700 rounded text-xs text-gray-300 capitalize">
            {subtype.replace(/_/g, ' ')}
          </span>
        )}
        {visibility.constellation && (
          <span className="px-2 py-1 bg-night-700 rounded text-xs text-gray-300">
            {visibility.constellation}
          </span>
        )}
        {/* Opposition badge for outer planets */}
        {visibility.isAtOpposition && (
          <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-medium">
            At Opposition
          </span>
        )}
        {/* Perihelion badge for planets */}
        {visibility.isNearPerihelion &&
          visibility.perihelionBoostPercent !== undefined &&
          visibility.perihelionBoostPercent > 0 && (
            <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-medium">
              Near Perihelion (+{visibility.perihelionBoostPercent}% brighter)
            </span>
          )}
        {/* Elongation for inner planets */}
        {visibility.elongationDeg !== undefined && visibility.elongationDeg > 15 && (
          <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">
            {visibility.elongationDeg.toFixed(1)}° elongation
          </span>
        )}
        {/* Saturn rings */}
        {visibility.saturnRings && (
          <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs">
            Rings: {visibility.saturnRings.tiltAngle}° ({visibility.saturnRings.openness})
          </span>
        )}
        {/* Libration info for Moon */}
        {visibility.libration && visibility.objectType === 'moon' && (
          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
            Libration: {Math.abs(visibility.libration.longitudeDeg).toFixed(1)}°{' '}
            {visibility.libration.longitudeDeg >= 0 ? 'E' : 'W'}
          </span>
        )}
        {/* Heliocentric distance for comets */}
        {visibility.heliocentricDistanceAU !== undefined &&
          (visibility.objectType === 'comet' || visibility.objectType === 'asteroid') && (
            <span className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs">
              {visibility.heliocentricDistanceAU.toFixed(2)} AU from Sun
            </span>
          )}
      </div>
    </div>
  );
}

function ScoreDetails({ breakdown }: { breakdown: ScoredObject['scoreBreakdown'] }) {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="flex justify-between">
        <span className="text-gray-500">Altitude</span>
        <span className="text-gray-300">{breakdown.altitudeScore}/40</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">Moon</span>
        <span className="text-gray-300">{breakdown.moonInterference}/30</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">Timing</span>
        <span className="text-gray-300">{breakdown.peakTiming}/15</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">Weather</span>
        <span className="text-gray-300">{breakdown.weatherScore}/15</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">Brightness</span>
        <span className="text-gray-300">{breakdown.surfaceBrightness}/20</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">Magnitude</span>
        <span className="text-gray-300">{breakdown.magnitudeScore}/15</span>
      </div>
      {/* Seeing Quality */}
      {breakdown.seeingQuality > 0 && (
        <div className="flex justify-between">
          <span className="text-cyan-400">Seeing</span>
          <span className="text-cyan-400">+{breakdown.seeingQuality}</span>
        </div>
      )}
      {/* Meridian Bonus */}
      {breakdown.meridianBonus > 0 && (
        <div className="flex justify-between">
          <span className="text-indigo-400">Meridian</span>
          <span className="text-indigo-400">+{breakdown.meridianBonus}</span>
        </div>
      )}
      {/* Opposition bonus */}
      {breakdown.oppositionBonus > 0 && (
        <div className="flex justify-between">
          <span className="text-red-400">Opposition</span>
          <span className="text-red-400">+{breakdown.oppositionBonus}</span>
        </div>
      )}
      {/* Perihelion bonus */}
      {breakdown.perihelionBonus > 0 && (
        <div className="flex justify-between">
          <span className="text-green-400">Perihelion</span>
          <span className="text-green-400">+{breakdown.perihelionBonus}</span>
        </div>
      )}
      {breakdown.elongationBonus > 0 && (
        <div className="flex justify-between">
          <span className="text-purple-400">Elongation</span>
          <span className="text-purple-400">+{breakdown.elongationBonus}</span>
        </div>
      )}
      {breakdown.supermoonBonus > 0 && (
        <div className="flex justify-between">
          <span className="text-yellow-400">Supermoon</span>
          <span className="text-yellow-400">+{breakdown.supermoonBonus}</span>
        </div>
      )}
      {breakdown.venusPeakBonus > 0 && (
        <div className="flex justify-between">
          <span className="text-yellow-200">Venus Peak</span>
          <span className="text-yellow-200">+{breakdown.venusPeakBonus}</span>
        </div>
      )}
      {/* Penalties */}
      {breakdown.twilightPenalty < 0 && (
        <div className="flex justify-between">
          <span className="text-orange-400">Near Sun</span>
          <span className="text-orange-400">{breakdown.twilightPenalty}</span>
        </div>
      )}
      {breakdown.dewRiskPenalty < 0 && (
        <div className="flex justify-between">
          <span className="text-blue-400">Dew Risk</span>
          <span className="text-blue-400">{breakdown.dewRiskPenalty}</span>
        </div>
      )}
    </div>
  );
}

function ObjectDetails({ visibility }: { visibility: ScoredObject['visibility'] }) {
  return (
    <div className="space-y-1 text-xs text-gray-400">
      {visibility.above75Start && visibility.above75End && (
        <p>
          Excellent (75°+): {formatTime(visibility.above75Start)} -{' '}
          {formatTime(visibility.above75End)}
        </p>
      )}
      {visibility.above60Start && visibility.above60End && (
        <p>
          Very good (60°+): {formatTime(visibility.above60Start)} -{' '}
          {formatTime(visibility.above60End)}
        </p>
      )}
      {visibility.above45Start && visibility.above45End && (
        <p>
          Good (45°+): {formatTime(visibility.above45Start)} - {formatTime(visibility.above45End)}
        </p>
      )}
      <p>Airmass at peak: {visibility.minAirmass.toFixed(2)}</p>
    </div>
  );
}
