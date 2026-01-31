import { useState } from 'react';
import { ChevronDown, ChevronUp, Moon, Clock, Mountain } from 'lucide-react';
import type { ScoredObject, NightInfo, NightWeather } from '@/types';
import { getScoreTier, getTierDisplay } from '@/lib/scoring';
import {
  getCategoryIcon,
  formatTime,
  formatAltitude,
  formatMagnitude,
  formatMoonSeparation,
  getAltitudeQualityClass,
  getStarRating,
} from '@/lib/utils/format';

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
        className="bg-night-800 rounded-lg p-3 cursor-pointer card-hover"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="text-white font-medium truncate">
                {visibility.commonName || visibility.objectName}
              </h4>
              <span className={`text-sm font-medium ${tierDisplay.color}`}>
                {totalScore}/200
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
              <span className={getAltitudeQualityClass(visibility.maxAltitude)}>
                {formatAltitude(visibility.maxAltitude)}
              </span>
              {visibility.maxAltitudeTime && (
                <span>@ {formatTime(visibility.maxAltitudeTime)}</span>
              )}
              {magnitude !== null && (
                <span>mag {formatMagnitude(magnitude)}</span>
              )}
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
          <div className={`text-lg font-bold ${tierDisplay.color}`}>
            {totalScore}
          </div>
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
            <span className="text-gray-500">
              @ {formatTime(visibility.maxAltitudeTime)}
            </span>
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
              {visibility.above60Start
                ? `Above 60°: ${formatTime(visibility.above60Start)} - ${formatTime(visibility.above60End!)}`
                : visibility.above45Start
                ? `Above 45°: ${formatTime(visibility.above45Start)} - ${formatTime(visibility.above45End!)}`
                : 'Brief visibility window'}
            </span>
          </div>
        )}
      </div>

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
    </div>
  );
}

function ObjectDetails({
  visibility,
}: {
  visibility: ScoredObject['visibility'];
}) {
  return (
    <div className="space-y-1 text-xs text-gray-400">
      {visibility.above75Start && (
        <p>
          Excellent (75°+): {formatTime(visibility.above75Start)} - {formatTime(visibility.above75End!)}
        </p>
      )}
      {visibility.above60Start && (
        <p>
          Very good (60°+): {formatTime(visibility.above60Start)} - {formatTime(visibility.above60End!)}
        </p>
      )}
      {visibility.above45Start && (
        <p>
          Good (45°+): {formatTime(visibility.above45Start)} - {formatTime(visibility.above45End!)}
        </p>
      )}
      <p>Airmass at peak: {visibility.minAirmass.toFixed(2)}</p>
    </div>
  );
}
