import { Camera, Clock, Compass, Focus, Moon, Mountain, Ruler, Star, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { RatingStars } from '@/components/ui/Rating';
import Tooltip from '@/components/ui/Tooltip';
import { formatDistance } from '@/lib/gaia';
import { fetchEnhancedGaiaStarField } from '@/lib/gaia/enhanced-queries';
import { formatFOV, getEffectiveFOV } from '@/lib/telescopes';
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
import type {
  CustomFOV,
  EnhancedGaiaStarField,
  NightInfo,
  ScoredObject,
  TelescopePresetId,
} from '@/types';
import EnhancedStarFieldCanvas from './EnhancedStarFieldCanvas';

interface DSODetailModalProps {
  object: ScoredObject;
  nightInfo: NightInfo; // For future use with best observation time
  telescope: TelescopePresetId;
  customFOV: CustomFOV | null;
  onClose: () => void;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Modal with multiple sections and data display
export default function DSODetailModal({
  object,
  nightInfo: _nightInfo,
  telescope,
  customFOV,
  onClose,
}: DSODetailModalProps) {
  const [starField, setStarField] = useState<EnhancedGaiaStarField | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { visibility, magnitude, category, subtype, totalScore } = object;
  const fov = getEffectiveFOV(telescope, customFOV);
  const icon = getCategoryIcon(category, subtype);

  // Lock body scroll when modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Fetch Gaia star field on mount
  useEffect(() => {
    let cancelled = false;

    async function loadStarField() {
      setLoading(true);
      setError(null);

      try {
        // Use larger of FOV dimensions for search radius
        const searchRadiusDeg = Math.max(fov.width, fov.height) / 60 / 2;

        // Fetch enhanced star field with variable stars and galaxies
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
  }, [visibility.raHours, visibility.decDegrees, fov.width, fov.height, object.objectName]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click to close is supplementary to close button
    // biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop interaction
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-hidden"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-night-900 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col border border-night-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-night-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{icon}</span>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {visibility.commonName || visibility.objectName}
              </h2>
              {visibility.commonName && visibility.commonName !== visibility.objectName && (
                <p className="text-sm text-gray-500">{visibility.objectName}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-night-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Rating and basic info */}
          <div className="flex items-center justify-between">
            <RatingStars score={totalScore} maxScore={220} size="md" />
            <div className="flex items-center gap-2 text-sm">
              {magnitude !== null && (
                <span className="text-gray-400">mag {formatMagnitude(magnitude)}</span>
              )}
              {subtype && (
                <span className="px-2 py-0.5 bg-night-700 rounded text-xs text-gray-300">
                  {formatSubtype(subtype)}
                </span>
              )}
            </div>
          </div>

          {/* Star Field Canvas */}
          <div className="bg-night-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Star className="w-4 h-4" />
                <span>Star Field Preview</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Focus className="w-3 h-3" />
                <span>FOV: {formatFOV(fov.width, fov.height)}</span>
              </div>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-16 bg-night-900 rounded-lg">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Loading star field...</p>
                </div>
              </div>
            )}

            {error && !loading && (
              <div className="flex items-center justify-center py-16 bg-night-900 rounded-lg">
                <div className="text-center">
                  <Star className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">{error}</p>
                  <p className="text-xs text-gray-500 mt-1">
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
              />
            )}
          </div>

          {/* Distance */}
          {!loading && starField && (
            <div className="flex items-center gap-2 text-sm">
              <Ruler className="w-4 h-4 text-purple-400" />
              <span className="text-gray-400">Estimated distance:</span>
              <span className="text-purple-400 font-medium">
                {formatDistance(starField.distanceLy)}
              </span>
            </div>
          )}

          {/* Object details */}
          <div className="grid grid-cols-2 gap-3">
            <DetailItem
              icon={<Mountain className="w-4 h-4 text-yellow-400" />}
              label="Peak Altitude"
              value={formatAltitude(visibility.maxAltitude)}
              valueClass={getAltitudeQualityClass(visibility.maxAltitude)}
            />
            <DetailItem
              icon={<Clock className="w-4 h-4 text-blue-400" />}
              label="Peak Time"
              value={visibility.maxAltitudeTime ? formatTime(visibility.maxAltitudeTime) : '—'}
            />
            <DetailItem
              icon={<Moon className="w-4 h-4 text-amber-400" />}
              label="Moon Separation"
              value={
                visibility.moonSeparation !== null
                  ? formatMoonSeparation(visibility.moonSeparation)
                  : '—'
              }
              valueClass={visibility.moonWarning ? 'text-amber-400' : ''}
            />
            <DetailItem
              icon={<Compass className="w-4 h-4 text-indigo-400" />}
              label="Meridian"
              value={
                visibility.meridianTransitTime ? formatTime(visibility.meridianTransitTime) : '—'
              }
              tooltip="Meridian transit is when the object crosses the north-south line and reaches its highest point. Best time to observe as it passes through the least atmosphere."
            />
          </div>

          {/* Imaging window */}
          {visibility.imagingWindow && (
            <div className="bg-night-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm mb-2">
                <Camera className="w-4 h-4 text-green-400" />
                <span className="text-gray-400">Best Imaging Window</span>
              </div>
              <div className="text-white">
                {formatTimeRange(visibility.imagingWindow.start, visibility.imagingWindow.end)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Quality: {visibility.imagingWindow.quality} (score:{' '}
                {visibility.imagingWindow.qualityScore})
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
            <div className="bg-night-800 rounded-lg p-3 space-y-1 text-sm">
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

          {/* Coordinates */}
          <div className="text-xs text-gray-500 text-center">
            RA: {visibility.raHours.toFixed(4)}h · Dec: {visibility.decDegrees.toFixed(2)}°
            {visibility.constellation && ` · ${visibility.constellation}`}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-night-700 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 bg-night-800 hover:bg-night-700 text-white font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
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
    <div className={`bg-night-800 rounded-lg p-2 ${tooltip ? 'cursor-help' : ''}`}>
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
        {icon}
        <span className={tooltip ? 'border-b border-dotted border-gray-500' : ''}>{label}</span>
      </div>
      <div className={`text-sm font-medium ${valueClass || 'text-white'}`}>{value}</div>
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
      <span className="text-gray-400 w-14 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-night-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${colorClass}`}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
      <span className="text-gray-500 w-8 text-right">{Math.round(clampedValue)}</span>
    </div>
  );
}
