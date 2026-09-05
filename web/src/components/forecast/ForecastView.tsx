import { RefreshCw, Sparkles } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { useHorizonProfile } from '@/hooks/useHorizonProfile';
import { useUIState } from '@/hooks/useUIState';
import { formatDateKey, formatDateRange } from '@/lib/utils/format';
import type { TargetAccessibility } from '@/lib/utils/horizon-profile';
import type { Location, NightForecast, ScoredObject, SkyMapFocus } from '@/types';
import FieldTools from './FieldTools';
import NightStrip from './NightStrip';
import ObjectDetailPanel from './ObjectDetailPanel';
import SessionPlanCard from './SessionPlanCard';
import TabBar from './TabBar';
import OverviewTab from './tabs/OverviewTab';

// Lazy-load heavier tabs to defer loading DnD Kit (TargetsTab) and d3-celestial init (SkyTab).
// Chunk-load failures after deploys are handled globally via `vite:preloadError` in main.tsx.
const TargetsTab = lazy(() => import('./tabs/TargetsTab'));
const SkyTab = lazy(() => import('./tabs/SkyTab'));
const EventsTab = lazy(() => import('./tabs/EventsTab'));

interface ForecastViewProps {
  forecasts: NightForecast[];
  scoredObjects: Map<string, ScoredObject[]> | null;
  bestNights: string[];
  location: Location;
  onRefresh: () => void;
  isRefreshing?: boolean;
  loadingMessage?: string;
  loadingPercent?: number;
  requestedNights?: number;
}

export default function ForecastView({
  forecasts,
  scoredObjects,
  bestNights,
  location,
  onRefresh,
  isRefreshing = false,
  loadingMessage = '',
  loadingPercent = 0,
  requestedNights = forecasts.length,
}: ForecastViewProps) {
  const [selectedNightIndex, setSelectedNightIndex] = useState(0);
  const [selectedTarget, setSelectedTarget] = useState<{
    object: ScoredObject;
    accessibility?: TargetAccessibility;
  } | null>(null);
  const [skyFocus, setSkyFocus] = useState<SkyMapFocus | null>(null);
  const { activeTab, setActiveTab } = useUIState();
  // Held here rather than in TargetsTab so the target detail panel can draw the
  // same horizon limits the target list filters by.
  const horizon = useHorizonProfile();

  if (forecasts.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 text-center text-gray-400">
        No forecast data available.
      </div>
    );
  }

  const firstNight = forecasts[0];
  const lastNight = forecasts[forecasts.length - 1];
  const selectedNight = forecasts[Math.min(selectedNightIndex, forecasts.length - 1)];
  const selectedDateKey = formatDateKey(selectedNight.nightInfo.date, location.timezone);
  const selectedObjects = scoredObjects?.get(selectedDateKey) ?? [];

  return (
    <main
      data-testid="forecast-view"
      className="safe-area-inset container mx-auto px-4 py-4 sm:py-6"
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-bold text-lg text-white sm:text-2xl">
            <Sparkles className="h-5 w-5 flex-shrink-0 text-sky-400 sm:h-6 sm:w-6" />
            <span className="truncate">Your sky, tonight and beyond</span>
          </h2>
          <p className="mt-0.5 text-gray-400 text-xs sm:text-sm">
            {formatDateRange(
              firstNight.nightInfo.date,
              lastNight.nightInfo.date,
              location.timezone
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label={isRefreshing ? 'Updating forecast' : 'Refresh forecast'}
          className="inline-flex flex-shrink-0 items-center gap-2 rounded-lg bg-night-800 px-3 py-2 text-sm text-white transition-colors hover:bg-night-700"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {isRefreshing && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-sky-400/15 bg-sky-400/5 px-4 py-3"
        >
          <p className="text-sky-200 text-xs">
            {forecasts.length < requestedNights
              ? `${forecasts.length} of ${requestedNights} nights ready. You can start exploring.`
              : loadingMessage || 'Updating your forecast…'}
          </p>
          <div
            role="progressbar"
            aria-label="Forecast progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={loadingPercent}
            className="mt-2 h-1 overflow-hidden rounded-full bg-night-800"
          >
            <div
              className="h-full rounded-full bg-sky-400 transition-all"
              style={{ width: `${loadingPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Night Strip */}
      <div className="mb-4">
        <NightStrip
          forecasts={forecasts}
          selectedIndex={selectedNightIndex}
          onSelectNight={setSelectedNightIndex}
          bestNights={bestNights}
          timezone={location.timezone}
        />
      </div>

      <div className="mb-3 flex justify-end">
        <FieldTools />
      </div>

      {/* Desktop: tabs above content */}
      <div className="mb-4 hidden sm:block">
        <TabBar variant="top" />
      </div>

      {/* Tab content — add bottom padding on mobile for the fixed nav bar */}
      <div
        id={`tabpanel-${activeTab}`}
        role="tabpanel"
        aria-label={`${activeTab.charAt(0).toUpperCase()}${activeTab.slice(1)}`}
        className="pb-20 sm:pb-0"
      >
        {activeTab === 'overview' && (
          <div className="space-y-5">
            <SessionPlanCard
              objects={selectedObjects}
              forecast={selectedNight}
              location={location}
              profile={horizon.horizonProfile}
              isReady={horizon.isReady}
              onSelect={(object, accessibility) => setSelectedTarget({ object, accessibility })}
              onBrowse={() => setActiveTab('targets')}
            />
            <OverviewTab forecast={selectedNight} location={location} />
          </div>
        )}
        <Suspense fallback={<TabSkeleton />}>
          {activeTab === 'targets' && (
            <TargetsTab
              objects={selectedObjects}
              forecast={selectedNight}
              forecastRange={forecasts}
              nightInfo={selectedNight.nightInfo}
              weather={selectedNight.weather}
              astronomicalEvents={selectedNight.astronomicalEvents}
              latitude={location.latitude}
              location={location}
              horizon={horizon}
              onObjectSelect={(object, accessibility) =>
                setSelectedTarget({ object, accessibility })
              }
              onShowSky={focus => {
                setSkyFocus(focus);
                setActiveTab('sky');
              }}
            />
          )}
          {activeTab === 'sky' && (
            <SkyTab nightInfo={selectedNight.nightInfo} location={location} focus={skyFocus} />
          )}
          {activeTab === 'events' && <EventsTab forecast={selectedNight} location={location} />}
        </Suspense>
      </div>

      {/* Mobile: bottom tab bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 sm:hidden">
        <TabBar variant="bottom" />
      </div>

      {/* Object detail panel */}
      {selectedTarget && (
        <ObjectDetailPanel
          object={selectedTarget.object}
          accessibility={selectedTarget.accessibility}
          horizonProfile={horizon.horizonProfile}
          nightInfo={selectedNight.nightInfo}
          weather={selectedNight.weather}
          onClose={() => setSelectedTarget(null)}
        />
      )}
    </main>
  );
}

function TabSkeleton() {
  return (
    <div className="animate-pulse space-y-4 py-4">
      <div className="h-6 w-48 rounded bg-night-800" />
      <div className="h-32 rounded-lg bg-night-800" />
      <div className="h-32 rounded-lg bg-night-800" />
    </div>
  );
}
