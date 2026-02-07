import { Camera, ChevronDown, ChevronUp, Clock, Compass, Moon, Mountain } from 'lucide-react';
import { useState } from 'react';
import Rating, { RatingStars } from '@/components/ui/Rating';
import Tooltip from '@/components/ui/Tooltip';
import { formatImagingWindow } from '@/lib/astronomy/imaging-windows';
import { formatAsteroidDiameter, formatRotationPeriod } from '@/lib/jpl/sbdb';
import { calculateFrameFillPercent, calculateMosaicPanels } from '@/lib/scoring';
import { getEffectiveFOV } from '@/lib/telescopes';
import {
  formatAltitude,
  formatMagnitude,
  formatMoonSeparation,
  formatTime,
  formatTimeRange,
  getAltitudeQualityClass,
  getCategoryIcon,
} from '@/lib/utils/format';
import { formatSubtype } from '@/lib/utils/format-subtype';
import { getImagingQualityColorClass } from '@/lib/utils/quality-helpers';
import { useApp } from '@/stores/AppContext';
import type { NightInfo, NightWeather, ObjectVisibility, ScoredObject } from '@/types';

interface ObjectCardProps {
  object: ScoredObject;
  nightInfo: NightInfo;
  weather: NightWeather | null;
  compact?: boolean;
  onDSOClick?: (object: ScoredObject) => void;
  onSelect?: (object: ScoredObject) => void;
}

interface BadgeConfig {
  id: string;
  bgClass: string;
  textClass: string;
  text: string;
}

/**
 * Build badge configurations for an object
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Badge logic requires checking multiple conditions
function buildBadgeConfigs(
  visibility: ObjectVisibility,
  magnitude: number | null,
  subtype: string | null | undefined,
  fov: { width: number; height: number } | null = null
): BadgeConfig[] {
  const badges: BadgeConfig[] = [];

  if (magnitude !== null) {
    badges.push({
      id: 'magnitude',
      bgClass: 'bg-night-700',
      textClass: 'text-gray-300',
      text: `mag ${formatMagnitude(magnitude)}`,
    });
  }

  if (subtype) {
    badges.push({
      id: 'subtype',
      bgClass: 'bg-night-700',
      textClass: 'text-gray-300',
      text: formatSubtype(subtype),
    });
  }

  if (visibility.constellation) {
    badges.push({
      id: 'constellation',
      bgClass: 'bg-night-700',
      textClass: 'text-gray-300',
      text: visibility.constellation,
    });
  }

  if (visibility.isAtOpposition) {
    badges.push({
      id: 'opposition',
      bgClass: 'bg-red-500/20',
      textClass: 'text-red-400 font-medium',
      text: 'At Opposition',
    });
  }

  if (
    visibility.isNearPerihelion &&
    visibility.perihelionBoostPercent !== undefined &&
    visibility.perihelionBoostPercent > 0
  ) {
    badges.push({
      id: 'perihelion',
      bgClass: 'bg-green-500/20',
      textClass: 'text-green-400 font-medium',
      text: `Near Perihelion (+${visibility.perihelionBoostPercent}% brighter)`,
    });
  }

  if (visibility.elongationDeg !== undefined && visibility.elongationDeg > 15) {
    badges.push({
      id: 'elongation',
      bgClass: 'bg-purple-500/20',
      textClass: 'text-purple-400',
      text: `${visibility.elongationDeg.toFixed(1)}° elongation`,
    });
  }

  if (visibility.saturnRings) {
    badges.push({
      id: 'saturn-rings',
      bgClass: 'bg-amber-500/20',
      textClass: 'text-amber-400',
      text: `Rings: ${visibility.saturnRings.tiltAngle}° (${visibility.saturnRings.openness})`,
    });
  }

  if (visibility.libration && visibility.objectType === 'moon') {
    const dir = visibility.libration.longitudeDeg >= 0 ? 'E' : 'W';
    badges.push({
      id: 'libration',
      bgClass: 'bg-blue-500/20',
      textClass: 'text-blue-400',
      text: `Libration: ${Math.abs(visibility.libration.longitudeDeg).toFixed(1)}° ${dir}`,
    });
  }

  if (
    visibility.heliocentricDistanceAU !== undefined &&
    (visibility.objectType === 'comet' || visibility.objectType === 'asteroid')
  ) {
    badges.push({
      id: 'heliocentric',
      bgClass: 'bg-orange-500/20',
      textClass: 'text-orange-400',
      text: `${visibility.heliocentricDistanceAU.toFixed(2)} AU from Sun`,
    });
  }

  // Asteroid physical data from JPL SBDB
  if (visibility.physicalData) {
    const { diameter, spectralType, rotationPeriod } = visibility.physicalData;

    if (spectralType) {
      badges.push({
        id: 'spectral-type',
        bgClass: 'bg-cyan-500/20',
        textClass: 'text-cyan-400',
        text: spectralType,
      });
    }

    if (diameter !== null) {
      const formattedDiam = formatAsteroidDiameter(diameter);
      if (formattedDiam) {
        badges.push({
          id: 'diameter',
          bgClass: 'bg-teal-500/20',
          textClass: 'text-teal-400',
          text: formattedDiam,
        });
      }
    }

    if (rotationPeriod !== null) {
      const formattedRot = formatRotationPeriod(rotationPeriod);
      if (formattedRot) {
        badges.push({
          id: 'rotation',
          bgClass: 'bg-violet-500/20',
          textClass: 'text-violet-400',
          text: `${formattedRot} rotation`,
        });
      }
    }
  }

  // Frame fill and mosaic badges for FOV context
  if (fov && visibility.angularSizeArcmin > 0) {
    const frameFill = calculateFrameFillPercent(
      visibility.angularSizeArcmin,
      visibility.objectType,
      fov
    );
    if (frameFill !== null) {
      badges.push({
        id: 'frame-fill',
        bgClass: 'bg-sky-500/20',
        textClass: 'text-sky-400',
        text: `${frameFill}% fill`,
      });
    }

    const mosaic = calculateMosaicPanels(visibility.angularSizeArcmin, fov);
    if (mosaic) {
      badges.push({
        id: 'mosaic',
        bgClass: 'bg-sky-500/20',
        textClass: 'text-sky-400',
        text: `${mosaic.cols}\u00d7${mosaic.rows} mosaic`,
      });
    }
  }

  return badges;
}

/**
 * Render astronomical badges for an object
 */
function AstronomicalBadges({
  visibility,
  magnitude,
  subtype,
  fov = null,
}: {
  visibility: ObjectVisibility;
  magnitude: number | null;
  subtype: string | null | undefined;
  fov?: { width: number; height: number } | null;
}) {
  const badges = buildBadgeConfigs(visibility, magnitude, subtype, fov);

  return (
    <>
      {badges.map(badge => (
        <span
          key={badge.id}
          className={`px-2 py-1 ${badge.bgClass} rounded text-xs ${badge.textClass}`}
        >
          {badge.text}
        </span>
      ))}
    </>
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Card component with multiple display modes and conditional content
export default function ObjectCard({
  object,
  nightInfo: _nightInfo,
  weather: _weather,
  compact = false,
  onDSOClick,
  onSelect,
}: ObjectCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { state } = useApp();
  const fov = getEffectiveFOV(state.settings.telescope, state.settings.customFOV);
  const { visibility, scoreBreakdown, totalScore, category, subtype, magnitude } = object;
  const frameFillPercent = calculateFrameFillPercent(visibility.angularSizeArcmin, category, fov);

  // All objects can be clicked when onSelect is provided; legacy onDSOClick only for DSOs
  const isDSO = category === 'dso';
  const isClickable = onSelect || (isDSO && onDSOClick);
  const handleCardClick = () => {
    if (onSelect) {
      onSelect(object);
    } else if (isDSO && onDSOClick) {
      onDSOClick(object);
    }
  };

  const icon = getCategoryIcon(category, subtype);

  if (compact) {
    return (
      <div
        role="button"
        tabIndex={0}
        className={`card-hover cursor-pointer rounded-lg bg-night-800 p-3 ${isClickable ? 'ring-1 ring-transparent hover:ring-sky-500/30' : ''}`}
        onClick={() => {
          if (isClickable) {
            handleCardClick();
          } else {
            setExpanded(!expanded);
          }
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (isClickable) {
              handleCardClick();
            } else {
              setExpanded(!expanded);
            }
          }
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <h4 className="truncate font-medium text-white">
                {visibility.commonName || visibility.objectName}
              </h4>
              <RatingStars score={totalScore} maxScore={235} size="sm" />
            </div>
            <div className="mt-1 flex items-center gap-3 text-gray-400 text-xs">
              <span className={getAltitudeQualityClass(visibility.maxAltitude)}>
                {formatAltitude(visibility.maxAltitude)}
              </span>
              {visibility.maxAltitudeTime && (
                <span>@ {formatTime(visibility.maxAltitudeTime)}</span>
              )}
              {magnitude !== null && <span>mag {formatMagnitude(magnitude)}</span>}
              {subtype && <span className="text-gray-500">• {formatSubtype(subtype)}</span>}
            </div>
            {visibility.imagingWindow && (
              <div className="mt-1 flex items-center gap-1.5 text-xs">
                <Camera className="h-3 w-3 text-green-400" />
                <span
                  className={`font-medium ${getImagingQualityColorClass(visibility.imagingWindow.quality)}`}
                >
                  {visibility.imagingWindow.quality.charAt(0).toUpperCase() +
                    visibility.imagingWindow.quality.slice(1)}
                </span>
                <span className="text-gray-500">
                  {formatTimeRange(visibility.imagingWindow.start, visibility.imagingWindow.end)}
                </span>
              </div>
            )}
          </div>
          {isClickable ? (
            <span className="text-sky-400 text-xs">View</span>
          ) : expanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </div>

        {expanded && !isClickable && (
          <div className="mt-3 space-y-2 border-night-700 border-t pt-3">
            <ScoreDetails breakdown={scoreBreakdown} frameFillPercent={frameFillPercent} />
            <ObjectDetails visibility={visibility} />
            <div className="flex flex-wrap gap-2 pt-2">
              <AstronomicalBadges
                visibility={visibility}
                magnitude={magnitude}
                subtype={subtype}
                fov={fov}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: role and tabIndex are conditionally applied
    <div
      className={`card-hover rounded-lg bg-night-800 p-4 ${isClickable ? 'cursor-pointer ring-1 ring-transparent hover:ring-sky-500/30' : ''}`}
      onClick={isClickable ? handleCardClick : undefined}
      onKeyDown={
        isClickable
          ? e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCardClick();
              }
            }
          : undefined
      }
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      <div className="flex items-start gap-3">
        <span className="text-3xl">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <RatingStars score={totalScore} maxScore={235} size="sm" />
          </div>
          <h4 className="font-medium text-white">
            {visibility.commonName || visibility.objectName}
          </h4>
          {visibility.commonName && visibility.commonName !== visibility.objectName && (
            <p className="text-gray-500 text-xs">{visibility.objectName}</p>
          )}
        </div>
        <div className="text-right">
          <Rating score={totalScore} maxScore={235} showStars={false} size="lg" />
        </div>
      </div>

      <div className="mt-3 space-y-2 text-sm">
        <div className="flex items-center gap-2 text-gray-400">
          <Mountain className="h-4 w-4" />
          <span className={getAltitudeQualityClass(visibility.maxAltitude)}>
            {formatAltitude(visibility.maxAltitude)} peak
          </span>
          {visibility.maxAltitudeTime && (
            <span className="text-gray-500">@ {formatTime(visibility.maxAltitudeTime)}</span>
          )}
        </div>

        {visibility.moonSeparation !== null && (
          <div className="flex items-center gap-2 text-gray-400">
            <Moon className="h-4 w-4" />
            <span className={visibility.moonWarning ? 'text-amber-400' : ''}>
              {formatMoonSeparation(visibility.moonSeparation)}
            </span>
          </div>
        )}

        {(visibility.above45Start || visibility.above60Start) && (
          <div className="flex items-center gap-2 text-gray-400">
            <Clock className="h-4 w-4" />
            <span>
              {visibility.above60Start && visibility.above60End
                ? `Above 60°: ${formatTimeRange(visibility.above60Start, visibility.above60End)}`
                : visibility.above45Start && visibility.above45End
                  ? `Above 45°: ${formatTimeRange(visibility.above45Start, visibility.above45End)}`
                  : 'Brief visibility window'}
            </span>
          </div>
        )}
      </div>

      {/* Imaging Window */}
      {visibility.imagingWindow && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          <Camera className="h-4 w-4 text-green-400" />
          <span className="text-gray-400">Best Window:</span>
          <span
            className={`font-medium ${getImagingQualityColorClass(visibility.imagingWindow.quality)}`}
          >
            {formatImagingWindow(visibility.imagingWindow)}
          </span>
        </div>
      )}

      {/* Meridian Transit */}
      {visibility.meridianTransitTime && (
        <Tooltip content="Meridian transit is when the object crosses the north-south line and reaches its highest point in the sky. This is the best time to observe as it passes through the least atmosphere.">
          <div className="mt-2 flex cursor-help items-center gap-2 text-sm">
            <Compass className="h-4 w-4 text-indigo-400" />
            <span className="border-gray-500 border-b border-dotted text-gray-400">Meridian:</span>
            <span className="text-gray-300">{formatTime(visibility.meridianTransitTime)}</span>
          </div>
        </Tooltip>
      )}

      <div className="mt-3 flex flex-wrap gap-2 border-night-700 border-t pt-3">
        <AstronomicalBadges
          visibility={visibility}
          magnitude={magnitude}
          subtype={subtype}
          fov={fov}
        />
      </div>
    </div>
  );
}

function ScoreDetails({
  breakdown,
  frameFillPercent,
}: {
  breakdown: ScoredObject['scoreBreakdown'];
  frameFillPercent?: number | null;
}) {
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
        <span className="text-gray-300">{breakdown.weatherScore}/10</span>
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
      {breakdown.imagingWindowScore > 0 && (
        <div className="flex justify-between">
          <span className="text-green-400">Imaging Window</span>
          <span className="text-green-400">+{breakdown.imagingWindowScore}</span>
        </div>
      )}
      {breakdown.fovSuitability < 15 && (
        <div className="flex justify-between">
          <span className="text-sky-400">
            FOV Fit{frameFillPercent != null ? ` (${frameFillPercent}%)` : ''}
          </span>
          <span className="text-sky-400">{breakdown.fovSuitability}/15</span>
        </div>
      )}
    </div>
  );
}

function ObjectDetails({ visibility }: { visibility: ScoredObject['visibility'] }) {
  return (
    <div className="space-y-1 text-gray-400 text-xs">
      {visibility.above75Start && visibility.above75End && (
        <p>Excellent (75°+): {formatTimeRange(visibility.above75Start, visibility.above75End)}</p>
      )}
      {visibility.above60Start && visibility.above60End && (
        <p>Very good (60°+): {formatTimeRange(visibility.above60Start, visibility.above60End)}</p>
      )}
      {visibility.above45Start && visibility.above45End && (
        <p>Good (45°+): {formatTimeRange(visibility.above45Start, visibility.above45End)}</p>
      )}
      <p>Airmass at peak: {visibility.minAirmass.toFixed(2)}</p>
    </div>
  );
}
