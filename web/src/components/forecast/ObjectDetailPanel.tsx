import { Camera, Clock, Compass, Focus, Moon, Mountain, Ruler, Star, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RatingStars } from '@/components/ui/Rating';
import Tooltip from '@/components/ui/Tooltip';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { formatDistance } from '@/lib/gaia';
import { fetchEnhancedGaiaStarField } from '@/lib/gaia/enhanced-queries';
import { formatAsteroidDiameter, formatRotationPeriod } from '@/lib/jpl/sbdb';
import { calculateFrameFillPercent, calculateMosaicPanels } from '@/lib/scoring';
import { formatFOV, getEffectiveFOV } from '@/lib/telescopes';
import {
  azimuthToCardinal,
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
import type { EnhancedGaiaStarField, NightInfo, NightWeather, ScoredObject } from '@/types';
import EnhancedStarFieldCanvas from './EnhancedStarFieldCanvas';

interface ObjectDetailPanelProps {
  object: ScoredObject;
  nightInfo: NightInfo;
  weather: NightWeather | null;
  onClose: () => void;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Panel with multiple sections for all object types
export default function ObjectDetailPanel({
  object,
  nightInfo: _nightInfo,
  weather: _weather,
  onClose,
}: ObjectDetailPanelProps) {
  const [starField, setStarField] = useState<EnhancedGaiaStarField | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const { state } = useApp();
  const { visibility, magnitude, category, subtype, totalScore } = object;
  const fov = getEffectiveFOV(state.settings.telescope, state.settings.customFOV);
  const icon = getCategoryIcon(category, subtype);
  const frameFillPercent = calculateFrameFillPercent(visibility.angularSizeArcmin, category, fov);
  const mosaic = calculateMosaicPanels(
    visibility.angularSizeArcmin,
    fov,
    visibility.minorAxisArcmin
  );
  // Search radius: half-diagonal of mosaic area (or FOV when no mosaic)
  // Uses primitive result for stable useEffect dependency
  const mosaicW = fov.width * (mosaic ? mosaic.cols : 1);
  const mosaicH = fov.height * (mosaic ? mosaic.rows : 1);
  const searchRadiusDeg = (Math.sqrt(mosaicW ** 2 + mosaicH ** 2) / 2 / 60) * 1.1;
  // Only show star field for DSOs (Gaia queries don't work well for planets/solar-system objects)
  const showStarField = category === 'dso' && visibility.angularSizeArcmin > 0;

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setIsOpen(true));
  }, []);

  // Close with animation
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setTimeout(onClose, 300);
  }, [onClose]);

  // Swipe-to-dismiss for mobile bottom sheet
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragDelta = useRef(0);
  const isDragging = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    dragDelta.current = 0;
    isDragging.current = true;
    if (panelRef.current) {
      panelRef.current.style.transition = 'none';
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    // Only allow dragging down (positive delta)
    dragDelta.current = Math.max(0, delta);
    if (panelRef.current) {
      panelRef.current.style.transform = `translateY(${dragDelta.current}px)`;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (panelRef.current) {
      panelRef.current.style.transition = '';
      panelRef.current.style.transform = '';
    }
    // Dismiss if dragged down more than 100px
    if (dragDelta.current > 100) {
      handleClose();
    }
  }, [handleClose]);

  // Lock body scroll and scroll to top on mobile so the bottom sheet has a clean backdrop
  useBodyScrollLock({ scrollToTopOnMobile: true });

  // Fetch Gaia star field on mount (only for DSOs with angular size)
  useEffect(() => {
    if (!showStarField) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadStarField() {
      setLoading(true);
      setError(null);

      try {
        // Search radius pre-computed outside effect as half-diagonal of mosaic area
        const field = await fetchEnhancedGaiaStarField(
          visibility.raHours,
          visibility.decDegrees,
          searchRadiusDeg,
          object.objectName
        );

        if (cancelled) return;

        if (field) {
          setStarField(field);
        } else {
          setError('Star field data unavailable');
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load star field');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadStarField();

    return () => {
      cancelled = true;
    };
  }, [
    showStarField,
    visibility.raHours,
    visibility.decDegrees,
    object.objectName,
    searchRadiusDeg,
  ]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  const panelContent = (
    <div className="flex min-h-0 h-full flex-col">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-night-700 border-b p-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex-shrink-0 text-3xl">{icon}</span>
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-lg text-white">
              {visibility.commonName || visibility.objectName}
            </h2>
            {visibility.commonName && visibility.commonName !== visibility.objectName && (
              <p className="truncate text-gray-500 text-sm">{visibility.objectName}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="flex-shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-night-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {/* Rating and badges */}
        <div className="flex items-center justify-between">
          <RatingStars score={totalScore} maxScore={235} size="md" />
          <div className="flex items-center gap-2 text-sm">
            {magnitude !== null && (
              <span className="text-gray-400">mag {formatMagnitude(magnitude)}</span>
            )}
            {subtype && (
              <span className="rounded bg-night-700 px-2 py-0.5 text-gray-300 text-xs">
                {formatSubtype(subtype)}
              </span>
            )}
          </div>
        </div>

        {/* Star Field Canvas — only for DSOs with angular size */}
        {showStarField && (
          <div className="rounded-lg bg-night-800 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Star className="h-4 w-4" />
                <span>Star Field Preview</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <Focus className="h-3 w-3" />
                <span>
                  FOV: {formatFOV(fov.width, fov.height)}
                  {frameFillPercent !== null && ` · ${frameFillPercent}% fill`}
                  {mosaic && ` · ${mosaic.cols}\u00d7${mosaic.rows} mosaic`}
                </span>
              </div>
            </div>

            {loading && (
              <div className="flex items-center justify-center rounded-lg bg-night-900 py-16">
                <div className="text-center">
                  <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-sky-500 border-b-2" />
                  <p className="text-gray-500 text-sm">Loading star field...</p>
                </div>
              </div>
            )}

            {error && !loading && (
              <div className="flex items-center justify-center rounded-lg bg-night-900 py-16">
                <div className="text-center">
                  <Star className="mx-auto mb-2 h-8 w-8 text-gray-600" />
                  <p className="text-gray-400 text-sm">{error}</p>
                  <p className="mt-1 text-gray-500 text-xs">
                    Star field preview requires internet connection
                  </p>
                </div>
              </div>
            )}

            {!loading && !error && starField && (
              <EnhancedStarFieldCanvas
                starField={starField}
                fovWidth={fov.width}
                fovHeight={fov.height}
                objectSizeArcmin={visibility.angularSizeArcmin}
                mosaic={mosaic}
              />
            )}
          </div>
        )}

        {/* Distance */}
        {!loading && starField && (
          <div className="flex items-center gap-2 text-sm">
            <Ruler className="h-4 w-4 text-purple-400" />
            <span className="text-gray-400">Estimated distance:</span>
            <span className="font-medium text-purple-400">
              {formatDistance(starField.distanceLy)}
            </span>
          </div>
        )}

        {/* Object details grid */}
        <div className="grid grid-cols-2 gap-3">
          <DetailItem
            icon={<Mountain className="h-4 w-4 text-yellow-400" />}
            label="Peak Altitude"
            value={`${formatAltitude(visibility.maxAltitude)} ${azimuthToCardinal(visibility.azimuthAtPeak)}`}
            valueClass={getAltitudeQualityClass(visibility.maxAltitude)}
          />
          <DetailItem
            icon={<Clock className="h-4 w-4 text-blue-400" />}
            label="Peak Time"
            value={visibility.maxAltitudeTime ? formatTime(visibility.maxAltitudeTime) : '—'}
          />
          <DetailItem
            icon={<Moon className="h-4 w-4 text-amber-400" />}
            label="Moon Separation"
            value={
              visibility.moonSeparation !== null
                ? formatMoonSeparation(visibility.moonSeparation)
                : '—'
            }
            valueClass={visibility.moonWarning ? 'text-amber-400' : ''}
          />
          <DetailItem
            icon={<Compass className="h-4 w-4 text-indigo-400" />}
            label="Meridian"
            value={
              visibility.meridianTransitTime ? formatTime(visibility.meridianTransitTime) : '—'
            }
            tooltip="Meridian transit is when the object crosses the north-south line and reaches its highest point. Best time to observe as it passes through the least atmosphere."
          />
        </div>

        {/* Imaging window */}
        {visibility.imagingWindow && (
          <div className="rounded-lg bg-night-800 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm">
              <Camera className="h-4 w-4 text-green-400" />
              <span className="text-gray-400">Best Imaging Window</span>
            </div>
            <div className="text-white">
              {formatTimeRange(visibility.imagingWindow.start, visibility.imagingWindow.end)}
            </div>
            <div className="mt-1 text-gray-500 text-xs">
              Quality:{' '}
              <span className={getImagingQualityColorClass(visibility.imagingWindow.quality)}>
                {visibility.imagingWindow.quality.charAt(0).toUpperCase() +
                  visibility.imagingWindow.quality.slice(1)}
              </span>{' '}
              (score: {visibility.imagingWindow.qualityScore})
            </div>
            <div className="mt-3 space-y-2">
              <FactorBar label="Altitude" value={visibility.imagingWindow.factors.altitude} />
              <FactorBar label="Airmass" value={visibility.imagingWindow.factors.airmass} />
              <FactorBar label="Moon" value={visibility.imagingWindow.factors.moonInterference} />
              <FactorBar label="Clouds" value={visibility.imagingWindow.factors.cloudCover} />
            </div>
          </div>
        )}

        {/* Visibility windows */}
        {(visibility.above45Start || visibility.above60Start || visibility.above75Start) && (
          <div className="space-y-1 rounded-lg bg-night-800 p-3 text-sm">
            {visibility.above75Start && visibility.above75End && (
              <div className="flex justify-between">
                <span className="text-gray-400">Excellent (75°+)</span>
                <span className="text-gray-300">
                  {formatTimeRange(visibility.above75Start, visibility.above75End)}
                </span>
              </div>
            )}
            {visibility.above60Start && visibility.above60End && (
              <div className="flex justify-between">
                <span className="text-gray-400">Very Good (60°+)</span>
                <span className="text-gray-300">
                  {formatTimeRange(visibility.above60Start, visibility.above60End)}
                </span>
              </div>
            )}
            {visibility.above45Start && visibility.above45End && (
              <div className="flex justify-between">
                <span className="text-gray-400">Good (45°+)</span>
                <span className="text-gray-300">
                  {formatTimeRange(visibility.above45Start, visibility.above45End)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Object-specific badges */}
        <ObjectSpecificBadges visibility={visibility} />

        {/* Coordinates */}
        <div className="text-center text-gray-500 text-xs">
          RA: {visibility.raHours.toFixed(4)}h · Dec: {visibility.decDegrees.toFixed(2)}°
          {visibility.constellation && ` · ${visibility.constellation}`}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click supplementary to close button */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Single panel — side panel on desktop, bottom sheet on mobile */}
      <div
        ref={panelRef}
        className={`fixed z-50 border-night-700 bg-night-900 shadow-xl transition-transform duration-300 ease-out
          inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl border-t
          sm:inset-x-auto sm:top-0 sm:right-0 sm:bottom-auto sm:h-full sm:w-[400px] sm:max-h-full sm:rounded-none sm:border-t-0 sm:border-l ${
            isOpen
              ? 'translate-y-0 sm:translate-x-0'
              : 'translate-y-full sm:translate-y-0 sm:translate-x-full'
          }`}
      >
        {/* Drag handle — mobile only, swipe down to dismiss */}
        <div
          className="flex flex-shrink-0 cursor-grab justify-center pt-3 pb-2 sm:hidden"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="h-1.5 w-12 rounded-full bg-night-500" />
        </div>
        {panelContent}
      </div>
    </>
  );
}

function DetailItem({
  icon,
  label,
  value,
  valueClass = '',
  tooltip,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
  tooltip?: string;
}) {
  const content = (
    <div className={`rounded-lg bg-night-800 p-2 ${tooltip ? 'cursor-help' : ''}`}>
      <div className="mb-1 flex items-center gap-2 text-gray-500 text-xs">
        {icon}
        <span className={tooltip ? 'border-gray-500 border-b border-dotted' : ''}>{label}</span>
      </div>
      <div className={`font-medium text-sm ${valueClass || 'text-white'}`}>{value}</div>
    </div>
  );

  if (tooltip) {
    return <Tooltip content={tooltip}>{content}</Tooltip>;
  }
  return content;
}

function FactorBar({ label, value }: { label: string; value: number }) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const colorClass =
    clampedValue >= 75
      ? 'bg-green-400'
      : clampedValue >= 50
        ? 'bg-yellow-400'
        : clampedValue >= 25
          ? 'bg-orange-400'
          : 'bg-red-400';

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-14 shrink-0 text-gray-400">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-night-700">
        <div
          className={`h-full rounded-full ${colorClass}`}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
      <span className="w-8 text-right text-gray-500">{Math.round(clampedValue)}</span>
    </div>
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Badge logic checks multiple object-specific conditions
function ObjectSpecificBadges({ visibility }: { visibility: ScoredObject['visibility'] }) {
  const badges: Array<{ key: string; text: string; colorClass: string }> = [];

  if (visibility.isAtOpposition) {
    badges.push({
      key: 'opposition',
      text: 'At Opposition',
      colorClass: 'bg-red-500/20 text-red-400',
    });
  }
  if (
    visibility.isNearPerihelion &&
    visibility.perihelionBoostPercent &&
    visibility.perihelionBoostPercent > 0
  ) {
    badges.push({
      key: 'perihelion',
      text: `Near Perihelion (+${visibility.perihelionBoostPercent}% brighter)`,
      colorClass: 'bg-green-500/20 text-green-400',
    });
  }
  if (visibility.elongationDeg !== undefined && visibility.elongationDeg > 15) {
    badges.push({
      key: 'elongation',
      text: `${visibility.elongationDeg.toFixed(1)}° elongation`,
      colorClass: 'bg-purple-500/20 text-purple-400',
    });
  }
  if (visibility.saturnRings) {
    badges.push({
      key: 'saturn-rings',
      text: `Rings: ${visibility.saturnRings.tiltAngle}° (${visibility.saturnRings.openness})`,
      colorClass: 'bg-amber-500/20 text-amber-400',
    });
  }
  if (
    visibility.heliocentricDistanceAU !== undefined &&
    (visibility.objectType === 'comet' || visibility.objectType === 'asteroid')
  ) {
    badges.push({
      key: 'heliocentric',
      text: `${visibility.heliocentricDistanceAU.toFixed(2)} AU from Sun`,
      colorClass: 'bg-orange-500/20 text-orange-400',
    });
  }
  if (visibility.physicalData) {
    const { diameter, spectralType, rotationPeriod } = visibility.physicalData;
    if (spectralType) {
      badges.push({
        key: 'spectral',
        text: spectralType,
        colorClass: 'bg-cyan-500/20 text-cyan-400',
      });
    }
    if (diameter !== null) {
      const d = formatAsteroidDiameter(diameter);
      if (d) badges.push({ key: 'diameter', text: d, colorClass: 'bg-teal-500/20 text-teal-400' });
    }
    if (rotationPeriod !== null) {
      const r = formatRotationPeriod(rotationPeriod);
      if (r)
        badges.push({
          key: 'rotation',
          text: `${r} rotation`,
          colorClass: 'bg-violet-500/20 text-violet-400',
        });
    }
  }

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map(b => (
        <span key={b.key} className={`rounded px-2 py-1 font-medium text-xs ${b.colorClass}`}>
          {b.text}
        </span>
      ))}
    </div>
  );
}
