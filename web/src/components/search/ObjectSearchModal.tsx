/**
 * Object Search Modal
 *
 * Full-featured search interface for finding celestial objects
 * and displaying their visibility information.
 */

import {
  AlertCircle,
  Calendar,
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
import { searchCelestialObjects } from '@/lib/search/object-search';
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
        icon: <Eye className="w-4 h-4" />,
        bgColor: 'bg-green-500/10',
      };
    case 'visible_soon':
      return {
        label: 'Visible Soon',
        color: 'text-sky-400',
        icon: <Calendar className="w-4 h-4" />,
        bgColor: 'bg-sky-500/10',
      };
    case 'visible_later':
      return {
        label: 'Visible Later',
        color: 'text-yellow-400',
        icon: <Clock className="w-4 h-4" />,
        bgColor: 'bg-yellow-500/10',
      };
    case 'below_horizon':
      return {
        label: 'Below Horizon',
        color: 'text-orange-400',
        icon: <EyeOff className="w-4 h-4" />,
        bgColor: 'bg-orange-500/10',
      };
    case 'never_visible':
      return {
        label: 'Never Visible',
        color: 'text-red-400',
        icon: <AlertCircle className="w-4 h-4" />,
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
 * Format a date for display
 */
function formatDate(date: Date): string {
  const now = new Date();
  const diffDays = Math.round((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Tonight';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return `In ${diffDays} days`;
  if (diffDays < 30) return `In ${Math.round(diffDays / 7)} weeks`;
  if (diffDays < 365) return `In ${Math.round(diffDays / 30)} months`;
  return `In ${Math.round(diffDays / 365)} year(s)`;
}

/**
 * Format time for display
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Convert azimuth degrees to cardinal direction
 */
function azimuthToCardinal(azimuth: number): string {
  const normalized = ((azimuth % 360) + 360) % 360;
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(normalized / 45) % 8;
  return directions[index];
}

/**
 * Format angular size for display
 */
function formatAngularSize(arcmin: number): string {
  if (arcmin >= 60) {
    return `${(arcmin / 60).toFixed(1)}°`;
  }
  return `${arcmin.toFixed(1)}'`;
}

/**
 * Search result card component
 */
function SearchResultCard({
  result,
  isExpanded,
  onToggle,
}: {
  result: ObjectSearchResult;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const statusInfo = getStatusInfo(result.visibilityStatus);

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full rounded-lg border transition-all text-left ${
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
          <div className={`p-2 rounded-lg shrink-0 ${statusInfo.bgColor} ${statusInfo.color}`}>
            {statusInfo.icon}
          </div>

          {/* Object info */}
          <div className="flex-1 min-w-0">
            {/* Name row */}
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-white">{result.displayName}</h3>
              {result.messierNumber && (
                <span className="text-xs bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded shrink-0">
                  M{result.messierNumber}
                </span>
              )}
            </div>

            {/* Object type and details - wrapped for mobile */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-400 mt-1">
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
                  <span>Mag {result.magnitude.toFixed(1)}</span>
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
              className={`inline-flex items-center gap-1.5 mt-2 px-2 py-1 rounded-md text-xs font-medium ${statusInfo.bgColor} ${statusInfo.color}`}
            >
              {statusInfo.icon}
              <span>{statusInfo.label}</span>
              {!result.visibleTonight && result.nextVisibleDate && !result.neverVisible && (
                <span className="text-gray-400 ml-1">• {formatDate(result.nextVisibleDate)}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 border-t border-night-700 mt-0">
          <div className="pt-3 space-y-3">
            {/* Visibility details */}
            {result.visibleTonight && result.visibility && (
              <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/20">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-400">Peak Altitude</span>
                    <p className="text-white">{result.visibility.maxAltitude.toFixed(0)}°</p>
                  </div>
                  {result.visibility.maxAltitudeTime && (
                    <div>
                      <span className="text-gray-400">Peak Time</span>
                      <p className="text-white">{formatTime(result.visibility.maxAltitudeTime)}</p>
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
                        className={
                          result.visibility.moonSeparation < 30 ? 'text-yellow-400' : 'text-white'
                        }
                      >
                        {result.visibility.moonSeparation.toFixed(0)}°
                        {result.visibility.moonWarning && ' ⚠️'}
                      </p>
                    </div>
                  )}
                  {result.visibility.above45Start && result.visibility.above45End && (
                    <div className="col-span-2">
                      <span className="text-gray-400">Good Observing (45°+)</span>
                      <p className="text-white">
                        {formatTime(result.visibility.above45Start)} -{' '}
                        {formatTime(result.visibility.above45End)}
                      </p>
                    </div>
                  )}
                  {/* Show optimal viewing note if not optimal tonight */}
                  {!result.visibility.above45Start &&
                    !result.canReachOptimal &&
                    result.optimalAltitudeNote && (
                      <div className="col-span-2">
                        <span className="text-yellow-400 text-xs">
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
                        <p className="text-sky-400">{formatDate(result.nextOptimalDate)}</p>
                      </div>
                    )}
                </div>
              </div>
            )}

            {/* Next visible date */}
            {!result.visibleTonight && result.nextVisibleDate && !result.neverVisible && (
              <div className="bg-sky-500/10 rounded-lg p-3 border border-sky-500/20">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-400">Peak Altitude</span>
                    <p className="text-white">{result.visibility?.maxAltitude.toFixed(0)}°</p>
                  </div>
                  {result.visibility?.maxAltitudeTime && (
                    <div>
                      <span className="text-gray-400">Peak Time</span>
                      <p className="text-white">{formatTime(result.visibility.maxAltitudeTime)}</p>
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
                      <span className="text-yellow-400 text-xs">{result.optimalAltitudeNote}</span>
                    </div>
                  )}
                  {result.canReachOptimal &&
                    result.nextOptimalDate &&
                    result.visibility &&
                    result.visibility.maxAltitude < 45 && (
                      <div className="col-span-2">
                        <span className="text-gray-400">Optimal Viewing (45°+)</span>
                        <p className="text-sky-400">{formatDate(result.nextOptimalDate)}</p>
                      </div>
                    )}
                </div>
              </div>
            )}

            {/* Never visible reason */}
            {result.neverVisible && result.neverVisibleReason && (
              <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/20">
                <p className="text-sm text-gray-300">{result.neverVisibleReason}</p>
                {result.maxPossibleAltitude > -90 && (
                  <p className="text-xs text-gray-400 mt-1">
                    Maximum possible altitude: {result.maxPossibleAltitude.toFixed(1)}°
                  </p>
                )}
              </div>
            )}

            {/* Coordinates */}
            <div className="text-xs text-gray-400 flex flex-wrap items-center gap-x-4 gap-y-1">
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
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ObjectSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lock body scroll when modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

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

  // Handle keyboard
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && query.trim().length >= 2) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      handleSearch(query);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 bg-black/60 backdrop-blur-sm overflow-hidden">
      <div className="bg-night-900 rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col border border-night-700">
        {/* Header with search input */}
        <div className="p-4 border-b border-night-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Search objects (e.g., M31, Andromeda, Jupiter, C/2023...)"
                className="w-full pl-10 pr-4 py-3 bg-night-800 border border-night-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-sky-400 animate-spin" />
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {searchMessage && <p className="text-xs text-gray-400 mt-2 pl-1">{searchMessage}</p>}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Empty state - no search yet */}
          {!hasSearched && (
            <div className="text-center py-8">
              <Star className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">
                Search for celestial objects by name or catalog code
              </p>
              <p className="text-gray-500 text-xs mt-2">
                Examples: M31, NGC 7000, Orion Nebula, Jupiter, Pluto, 12P
              </p>
            </div>
          )}

          {/* No results */}
          {hasSearched && !isSearching && results.length === 0 && (
            <div className="text-center py-8">
              <Search className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No objects found matching "{query}"</p>
              <p className="text-gray-500 text-xs mt-2">Try a different name or catalog number</p>
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
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer with location info */}
        <div className="p-3 border-t border-night-700 flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <MapPin className="w-3 h-3" />
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
