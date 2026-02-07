import { RefreshCw, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useUIState } from '@/hooks/useUIState';
import { formatDateRange } from '@/lib/utils/format';
import type { Location, NightForecast, ScoredObject } from '@/types';
import NightStrip from './NightStrip';
import ObjectDetailPanel from './ObjectDetailPanel';
import TabBar from './TabBar';
import EventsTab from './tabs/EventsTab';
import OverviewTab from './tabs/OverviewTab';
import SkyTab from './tabs/SkyTab';
import TargetsTab from './tabs/TargetsTab';

interface ForecastViewProps {
  forecasts: NightForecast[];
  scoredObjects: Map<string, ScoredObject[]> | null;
  bestNights: string[];
  location: Location;
  onRefresh: () => void;
}

export default function ForecastView({
  forecasts,
  scoredObjects,
  bestNights,
  location,
  onRefresh,
}: ForecastViewProps) {
  const [selectedNightIndex, setSelectedNightIndex] = useState(0);
  const [selectedObject, setSelectedObject] = useState<ScoredObject | null>(null);
  const { activeTab } = useUIState();

  if (forecasts.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 text-center text-gray-400">
        No forecast data available.
      </div>
    );
  }

  const firstNight = forecasts[0];
  const lastNight = forecasts[forecasts.length - 1];
  const selectedNight = forecasts[selectedNightIndex];
  const selectedDateKey = selectedNight.nightInfo.date.toISOString().split('T')[0];
  const selectedObjects = scoredObjects?.get(selectedDateKey) ?? [];

  return (
    <main className="safe-area-inset container mx-auto px-4 py-4 sm:py-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-bold text-lg text-white sm:text-2xl">
            <Sparkles className="h-5 w-5 flex-shrink-0 text-sky-400 sm:h-6 sm:w-6" />
            <span className="truncate">Sky Observation Forecast</span>
          </h2>
          <p className="mt-0.5 text-gray-400 text-xs sm:text-sm">
            {formatDateRange(firstNight.nightInfo.date, lastNight.nightInfo.date)}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex flex-shrink-0 items-center gap-2 rounded-lg bg-night-800 px-3 py-2 text-sm text-white transition-colors hover:bg-night-700"
        >
          <RefreshCw className="h-4 w-4" />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Night Strip */}
      <div className="mb-4">
        <NightStrip
          forecasts={forecasts}
          selectedIndex={selectedNightIndex}
          onSelectNight={setSelectedNightIndex}
          bestNights={bestNights}
        />
      </div>

      {/* Desktop: tabs above content */}
      <div className="mb-4 hidden sm:block">
        <TabBar variant="top" />
      </div>

      {/* Tab content — add bottom padding on mobile for the fixed nav bar */}
      <div className="pb-20 sm:pb-0">
        {activeTab === 'overview' && <OverviewTab forecast={selectedNight} />}
        {activeTab === 'targets' && (
          <TargetsTab
            objects={selectedObjects}
            nightInfo={selectedNight.nightInfo}
            weather={selectedNight.weather}
            astronomicalEvents={selectedNight.astronomicalEvents}
            latitude={location.latitude}
            onObjectSelect={setSelectedObject}
          />
        )}
        {activeTab === 'sky' && <SkyTab nightInfo={selectedNight.nightInfo} location={location} />}
        {activeTab === 'events' && <EventsTab forecast={selectedNight} location={location} />}
      </div>

      {/* Mobile: bottom tab bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 sm:hidden">
        <TabBar variant="bottom" />
      </div>

      {/* Object detail panel */}
      {selectedObject && (
        <ObjectDetailPanel
          object={selectedObject}
          nightInfo={selectedNight.nightInfo}
          weather={selectedNight.weather}
          onClose={() => setSelectedObject(null)}
        />
      )}
    </main>
  );
}
