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
import TargetSummary from '@/components/forecast/TargetSummary';
import Magnitude from '@/components/ui/Magnitude';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useHorizonProfile } from '@/hooks/useHorizonProfile';
import { searchCelestialObjects } from '@/lib/search/object-search';
import { getEffectiveFOV } from '@/lib/telescopes';
import {
  azimuthToCardinal,
  formatAngularSize,
  formatDate,
  formatMoonSeparation,
  formatTime,
} from '@/lib/utils/format';
import { formatSubtype } from '@/lib/utils/format-subtype';
import { useApp } from '@/stores/AppContext';
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
        label: 'Visible tonight',
        color: 'text-green-400',
        icon: <Eye className="h-4 w-4" />,
        bgColor: 'bg-green-500/10',
      };
    case 'visible_soon':
      return {
        label: 'Visible soon',
        color: 'text-sky-400',
        icon: <Calendar className="h-4 w-4" />,
        bgColor: 'bg-sky-500/10',
      };
    case 'visible_later':
      return {
        label: 'Visible later',
        color: 'text-yellow-400',
        icon: <Clock className="h-4 w-4" />,
        bgColor: 'bg-yellow-500/10',
      };
    case 'below_horizon':
      return {
        label: 'Below horizon',
        color: 'text-orange-400',
        icon: <EyeOff className="h-4 w-4" />,
        bgColor: 'bg-orange-500/10',
      };
    case 'never_visible':
      return {
        label: 'Never visible',
        color: 'text-red-400',
        icon: <AlertCircle className="h-4 w-4" />,
        bgColor: 'bg-red-500/10',
      };
  }
}

/** Search uses the same target summary as the forecast cards. */
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
  const status = getStatusInfo(result.visibilityStatus);
  return (
    <div className="rounded-xl border border-night-700 bg-night-800/30">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="w-full space-y-3 p-3 text-left"
      >
        <p className={`text-xs ${status.color}`}>
          {status.label}
          {!result.visibleTonight && result.nextVisibleDate
            ? ` · ${formatDate(result.nextVisibleDate, timezone)}`
            : ''}
        </p>
        {result.visibility ? (
          <TargetSummary
            name={result.displayName}
            magnitude={result.magnitude}
            visibility={result.visibility}
            category={result.objectType}
            subtype={result.subtype}
            totalScore={result.totalScore}
            timezone={timezone}
            weatherAvailable={result.totalScore !== undefined}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-white">{result.displayName}</h3>
            <Magnitude value={result.magnitude} />
          </div>
        )}
        {result.neverVisibleReason && (
          <p className="text-amber-300 text-xs">{result.neverVisibleReason}</p>
        )}
        <p className="text-sky-300 text-xs">
          {isExpanded ? 'Hide details' : 'Position & visibility details'}
        </p>
      </button>
      {isExpanded && (
        <div className="space-y-2 border-night-700 border-t p-3 text-gray-300 text-xs">
          <p>
            {result.subtype ? formatSubtype(result.subtype) : formatSubtype(result.objectType)}
            {result.angularSizeArcmin ? ` · ${formatAngularSize(result.angularSizeArcmin)}` : ''}
          </p>
          {result.visibility?.maxAltitudeTime && (
            <p>Peak time · {formatTime(result.visibility.maxAltitudeTime, timezone)}</p>
          )}
          {result.azimuthAtPeak !== null && (
            <p>Direction at peak · {azimuthToCardinal(result.azimuthAtPeak)}</p>
          )}
          {result.visibility?.moonSeparation !== null && result.visibility && (
            <p>
              Moon separation ·{' '}
              {result.visibility.moonAltitudeAtPeak !== null &&
              result.visibility.moonAltitudeAtPeak <= 0
                ? 'Below horizon at peak'
                : formatMoonSeparation(result.visibility.moonSeparation)}
            </p>
          )}
          {result.optimalAltitudeNote && (
            <p className="text-amber-300">{result.optimalAltitudeNote}</p>
          )}
          {result.totalScore === undefined && <p>Visibility only · no forecast rating available</p>}
          <p>
            RA {result.raHours.toFixed(4)}h · Dec {result.decDegrees.toFixed(2)}°
            {result.constellation ? ` · ${result.constellation}` : ''}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Main search modal component
 */
export default function ObjectSearchModal({ location, onClose }: ObjectSearchModalProps) {
  const { state } = useApp();
  const { horizonProfile, isReady } = useHorizonProfile();
  const requestId = useRef(0);
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
      const id = ++requestId.current;
      if (!isReady) return;
      if (searchQuery.trim().length < 2) {
        setResults([]);
        setHasSearched(false);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      setSearchMessage('Searching...');
      setExpandedIndex(null);
      setHasSearched(true);

      try {
        const searchResults = await searchCelestialObjects(
          searchQuery,
          location,
          20,
          message => {
            if (id === requestId.current) setSearchMessage(message);
          },
          new Date(),
          {
            horizonProfile,
            forecasts: state.forecasts ?? undefined,
            scoredObjects: state.scoredObjects ?? undefined,
            fov: getEffectiveFOV(state.settings.telescope, state.settings.customFOV),
          }
        );
        if (id !== requestId.current) return;
        setResults(searchResults);
      } catch {
        // Search failed silently, clear results
        if (id === requestId.current) setResults([]);
      } finally {
        if (id === requestId.current) {
          setIsSearching(false);
          setSearchMessage('');
        }
      }
    },
    [location, isReady, horizonProfile, state.forecasts, state.scoredObjects, state.settings]
  );

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    ++requestId.current;
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
        <h2 className="px-4 pt-4 font-semibold text-white">Search targets · tonight</h2>
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
