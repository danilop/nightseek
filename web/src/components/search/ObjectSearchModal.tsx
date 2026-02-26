/**
 * Object Search Modal
 *
 * Full-featured search interface for finding celestial objects
 * and displaying their visibility information.
 */

import {
  AlertCircle,
  Calendar,
  Camera,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  MapPin,
  Search,
  Star,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { formatImagingWindow } from '@/lib/astronomy/imaging-windows';
import { searchCelestialObjects } from '@/lib/search/object-search';
import {
  azimuthToCardinal,
  formatAltitude,
  formatAngularSize,
  formatMagnitude,
  formatMoonSeparation,
  formatRelativeDate,
  formatTime,
  getAltitudeQualityClass,
} from '@/lib/utils/format';
import { getImagingQualityColorClass } from '@/lib/utils/quality-helpers';
import { getRatingFromScore } from '@/lib/utils/rating';
import type { Location, ObjectSearchResult, ObjectVisibilityStatus } from '@/types';

interface ObjectSearchModalProps {
  location: Location;
  onClose: () => void;
}

/**
 * Get status display info
 */
function getStatusInfo(status: ObjectVisibilityStatus): {
  label: string;
  color: string;
  icon: React.ReactNode;
  bgColor: string;
} {
  switch (status) {
    case 'visible_tonight':
      return {
        label: 'Visible Tonight',
        color: 'text-green-400',
        icon: <Eye className="h-4 w-4" />,
        bgColor: 'bg-green-500/10',
      };
    case 'visible_soon':
      return {
        label: 'Visible Soon',
        color: 'text-sky-400',
        icon: <Calendar className="h-4 w-4" />,
        bgColor: 'bg-sky-500/10',
      };
    case 'visible_later':
      return {
        label: 'Visible Later',
        color: 'text-yellow-400',
        icon: <Clock className="h-4 w-4" />,
        bgColor: 'bg-yellow-500/10',
      };
    case 'below_horizon':
      return {
        label: 'Below Horizon',
        color: 'text-orange-400',
        icon: <EyeOff className="h-4 w-4" />,
        bgColor: 'bg-orange-500/10',
      };
    case 'never_visible':
      return {
        label: 'Never Visible',
        color: 'text-red-400',
        icon: <AlertCircle className="h-4 w-4" />,
        bgColor: 'bg-red-500/10',
      };
  }
}

/**
 * Get object type display name
 */
function getObjectTypeDisplay(type: string): string {
  const typeMap: Record<string, string> = {
    planet: 'Planet',
    dso: 'Deep Sky Object',
    comet: 'Comet',
    dwarf_planet: 'Dwarf Planet',
    asteroid: 'Asteroid',
    milky_way: 'Milky Way',
    moon: 'Moon',
  };
  return typeMap[type] || type;
}

/**
 * Search result card component
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: UI component displays many conditional states
function SearchResultCard({
  result,
  isExpanded,
  onToggle,
  timezone,
}: {
  result: ObjectSearchResult;
  isExpanded: boolean;
  onToggle: () => void;
  timezone?: string;
}) {
  const statusInfo = getStatusInfo(result.visibilityStatus);

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full rounded-lg border text-left transition-all ${
        isExpanded
          ? 'border-sky-500/50 bg-night-800/50'
          : 'border-night-700 bg-night-800/30 hover:border-night-600'
      }`}
    >
      {/* Header */}
      <div className="p-3">
        {/* Top row: Icon + Name + Messier badge */}
        <div className="flex items-start gap-3">
          {/* Status indicator */}
          <div className={`shrink-0 rounded-lg p-2 ${statusInfo.bgColor} ${statusInfo.color}`}>
            {statusInfo.icon}
          </div>

          {/* Object info */}
          <div className="min-w-0 flex-1">
            {/* Name row */}
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-medium text-white">{result.displayName}</h3>
              {result.messierNumber && (
                <span className="shrink-0 rounded bg-purple-500/20 px-1.5 py-0.5 text-purple-300 text-xs">
                  M{result.messierNumber}
                </span>
              )}
            </div>

            {/* Object type and details - wrapped for mobile */}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-gray-400 text-xs">
              <span>{getObjectTypeDisplay(result.objectType)}</span>
              {result.subtype && (
                <>
                  <span className="text-gray-600">|</span>
                  <span className="capitalize">{result.subtype.replace(/_/g, ' ')}</span>
                </>
              )}
              {result.magnitude !== null && (
                <>
                  <span className="text-gray-600">|</span>
                  <span>Mag {formatMagnitude(result.magnitude)}</span>
                </>
              )}
              {result.angularSizeArcmin !== null && result.angularSizeArcmin > 0 && (
                <>
                  <span className="text-gray-600">|</span>
                  <span>Size {formatAngularSize(result.angularSizeArcmin)}</span>
                </>
              )}
            </div>

            {/* Status badge - on its own row */}
            <div
              className={`mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium text-xs ${statusInfo.bgColor} ${statusInfo.color}`}
            >
              {statusInfo.icon}
              <span>{statusInfo.label}</span>
              {!result.visibleTonight && result.nextVisibleDate && !result.neverVisible && (
                <span className="ml-1 text-gray-400">
                  • {formatRelativeDate(result.nextVisibleDate)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="mt-0 border-night-700 border-t px-3 pt-0 pb-3">
          <div className="space-y-3 pt-3">
            {/* Visibility details */}
            {result.visibleTonight && result.visibility && (
              <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-3">
                {/* Mini star rating */}
                {(() => {
                  const rating = getRatingFromScore(result.visibility.maxAltitude, 90);
                  return (
                    <div className="mb-2 flex items-center gap-2">
                      <span className={`text-xs ${rating.color}`}>{rating.starString}</span>
                      <span className="text-gray-400 text-xs">{rating.label}</span>
                    </div>
                  );
                })()}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-400">Peak Altitude</span>
                    <p className={getAltitudeQualityClass(result.visibility.maxAltitude)}>
                      {formatAltitude(result.visibility.maxAltitude)}
                    </p>
                  </div>
                  {result.visibility.maxAltitudeTime && (
                    <div>
                      <span className="text-gray-400">Peak Time</span>
                      <p className="text-white">
                        {formatTime(result.visibility.maxAltitudeTime, timezone)}
                      </p>
                    </div>
                  )}
                  {result.azimuthAtPeak !== null && (
                    <div>
                      <span className="text-gray-400">Direction</span>
                      <p className="text-white">
                        {azimuthToCardinal(result.azimuthAtPeak)} ({result.azimuthAtPeak.toFixed(0)}
                        °)
                      </p>
                    </div>
                  )}
                  {result.visibility.moonSeparation !== null && (
                    <div>
                      <span className="text-gray-400">Moon Distance</span>
                      <p
                        className={result.visibility.moonWarning ? 'text-amber-400' : 'text-white'}
                      >
                        {formatMoonSeparation(result.visibility.moonSeparation)}
                        {result.visibility.moonWarning && ' ⚠️'}
                      </p>
                    </div>
                  )}
                  {result.visibility.above45Start && result.visibility.above45End && (
                    <div className="col-span-2">
                      <span className="text-gray-400">Good Observing (45°+)</span>
                      <p className="text-white">
                        {formatTime(result.visibility.above45Start, timezone)} –{' '}
                        {formatTime(result.visibility.above45End, timezone)}
                      </p>
                    </div>
                  )}
                  {/* Imaging window */}
                  {result.visibility.imagingWindow && (
                    <div className="col-span-2 flex items-center gap-2">
                      <Camera className="h-4 w-4 text-green-400" />
                      <span className="text-gray-400">Best Window:</span>
                      <span
                        className={`font-medium ${getImagingQualityColorClass(result.visibility.imagingWindow.quality)}`}
                      >
                        {formatImagingWindow(result.visibility.imagingWindow)}
                      </span>
                    </div>
                  )}
                  {/* Show optimal viewing note if not optimal tonight */}
                  {!result.visibility.above45Start &&
                    !result.canReachOptimal &&
                    result.optimalAltitudeNote && (
                      <div className="col-span-2">
                        <span className="text-xs text-yellow-400">
                          {result.optimalAltitudeNote}
                        </span>
                      </div>
                    )}
                  {/* Show next optimal date if visible but not optimal tonight */}
                  {!result.visibility.above45Start &&
                    result.canReachOptimal &&
                    result.nextOptimalDate && (
                      <div className="col-span-2">
                        <span className="text-gray-400">Optimal Viewing (45°+)</span>
                        <p className="text-sky-400">{formatRelativeDate(result.nextOptimalDate)}</p>
                      </div>
                    )}
                </div>
              </div>
            )}

            {/* Next visible date */}
            {!result.visibleTonight && result.nextVisibleDate && !result.neverVisible && (
              <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 p-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {result.visibility && (
                    <div>
                      <span className="text-gray-400">Peak Altitude</span>
                      <p className={getAltitudeQualityClass(result.visibility.maxAltitude)}>
                        {formatAltitude(result.visibility.maxAltitude)}
                      </p>
                    </div>
                  )}
                  {result.visibility?.maxAltitudeTime && (
                    <div>
                      <span className="text-gray-400">Peak Time</span>
                      <p className="text-white">
                        {formatTime(result.visibility.maxAltitudeTime, timezone)}
                      </p>
                    </div>
                  )}
                  {result.azimuthAtPeak !== null && (
                    <div>
                      <span className="text-gray-400">Direction</span>
                      <p className="text-white">
                        {azimuthToCardinal(result.azimuthAtPeak)} ({result.azimuthAtPeak.toFixed(0)}
                        °)
                      </p>
                    </div>
                  )}
                  {/* Optimal viewing info */}
                  {!result.canReachOptimal && result.optimalAltitudeNote && (
                    <div className="col-span-2">
                      <span className="text-xs text-yellow-400">{result.optimalAltitudeNote}</span>
                    </div>
                  )}
                  {result.canReachOptimal &&
                    result.nextOptimalDate &&
                    result.visibility &&
                    result.visibility.maxAltitude < 45 && (
                      <div className="col-span-2">
                        <span className="text-gray-400">Optimal Viewing (45°+)</span>
                        <p className="text-sky-400">{formatRelativeDate(result.nextOptimalDate)}</p>
                      </div>
                    )}
                </div>
              </div>
            )}

            {/* Never visible reason */}
            {result.neverVisible && result.neverVisibleReason && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                <p className="text-gray-300 text-sm">{result.neverVisibleReason}</p>
                {result.maxPossibleAltitude > -90 && (
                  <p className="mt-1 text-gray-400 text-xs">
                    Maximum possible altitude: {result.maxPossibleAltitude.toFixed(1)}°
                  </p>
                )}
              </div>
            )}

            {/* Coordinates */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-gray-400 text-xs">
              <span>
                RA: {result.raHours.toFixed(2)}h | Dec: {result.decDegrees.toFixed(1)}°
              </span>
              {result.constellation && <span>in {result.constellation}</span>}
              {result.isMovingObject && <span className="text-purple-400">(position changes)</span>}
            </div>
          </div>
        </div>
      )}
    </button>
  );
}

/**
 * Main search modal component
 */
export default function ObjectSearchModal({ location, onClose }: ObjectSearchModalProps) {
  const timezone = location.timezone;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ObjectSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusTrapRef = useFocusTrap<HTMLDivElement>();

  // Lock body scroll when modal is open
  useBodyScrollLock();

  // Close on Escape (global listener for when focus is outside input)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onClose]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search
  const handleSearch = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.trim().length < 2) {
        setResults([]);
        setHasSearched(false);
        return;
      }

      setIsSearching(true);
      setSearchMessage('Searching...');
      setExpandedIndex(null);
      setHasSearched(true);

      try {
        const searchResults = await searchCelestialObjects(searchQuery, location, 20, message => {
          setSearchMessage(message);
        });
        setResults(searchResults);

        // Auto-expand first result if only one
        if (searchResults.length === 1) {
          setExpandedIndex(0);
        }
      } catch {
        // Search failed silently, clear results
        setResults([]);
      } finally {
        setIsSearching(false);
        setSearchMessage('');
      }
    },
    [location]
  );

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce search
    searchTimeoutRef.current = setTimeout(() => {
      handleSearch(newQuery);
    }, 300);
  };

  // Handle keyboard on input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim().length >= 2) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      handleSearch(query);
    }
  };

  return (
    <div
      ref={focusTrapRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="object-search-title"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden bg-black/60 p-4 pt-16 backdrop-blur-sm"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={e => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl border border-night-700 bg-night-900 shadow-xl">
        {/* Header with search input */}
        <div className="flex-shrink-0 border-night-700 border-b p-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search
                aria-hidden="true"
                className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-gray-400"
              />
              <input
                id="object-search-title"
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Search objects (e.g., M31, Andromeda, Jupiter, C/2023...)"
                className="w-full rounded-lg border border-night-600 bg-night-800 py-3 pr-4 pl-10 text-white placeholder-gray-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              {isSearching && (
                <Loader2 className="absolute top-1/2 right-3 h-5 w-5 -translate-y-1/2 animate-spin text-sky-400" />
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-2 text-gray-400 transition-colors hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {searchMessage && <p className="mt-2 pl-1 text-gray-400 text-xs">{searchMessage}</p>}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Empty state - no search yet */}
          {!hasSearched && (
            <div className="py-8 text-center">
              <Star className="mx-auto mb-3 h-12 w-12 text-gray-600" />
              <p className="text-gray-400 text-sm">
                Search for celestial objects by name or catalog code
              </p>
              <p className="mt-2 text-gray-500 text-xs">
                Examples: M31, NGC 7000, Orion Nebula, Jupiter, Pluto, 12P
              </p>
            </div>
          )}

          {/* No results */}
          {hasSearched && !isSearching && results.length === 0 && (
            <div className="py-8 text-center">
              <Search className="mx-auto mb-3 h-12 w-12 text-gray-600" />
              <p className="text-gray-400 text-sm">No objects found matching "{query}"</p>
              <p className="mt-2 text-gray-500 text-xs">Try a different name or catalog number</p>
            </div>
          )}

          {/* Results list */}
          {results.length > 0 && (
            <div className="space-y-2">
              {results.map((result, index) => (
                <SearchResultCard
                  key={`${result.objectName}-${result.objectType}`}
                  result={result}
                  isExpanded={expandedIndex === index}
                  onToggle={() => setExpandedIndex(expandedIndex === index ? null : index)}
                  timezone={timezone}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer with location info */}
        <div className="flex-shrink-0 border-night-700 border-t p-3">
          <div className="flex items-center gap-2 text-gray-500 text-xs">
            <MapPin className="h-3 w-3" />
            <span>
              Visibility calculated for{' '}
              {location.name ||
                `${location.latitude.toFixed(2)}°, ${location.longitude.toFixed(2)}°`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
