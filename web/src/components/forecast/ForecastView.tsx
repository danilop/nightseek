import { RefreshCw, Sparkles, Star } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import Tooltip from '@/components/ui/Tooltip';
import { useUIState } from '@/hooks/useUIState';
import { formatDate, formatDateRange } from '@/lib/utils/format';
import type { Location, NightForecast, ScoredObject } from '@/types';
import EventsSection from './EventsSection';
import NightDetails from './NightDetails';
import NightSummaryTable from './NightSummaryTable';
import SatellitePassesCard from './SatellitePassesCard';
import SkyChart from './SkyChart';
import TonightHighlights from './TonightHighlights';

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
  const { activeTab, setActiveTab } = useUIState();
  const nightTableRef = useRef<HTMLDivElement>(null);

  // Navigate to a specific night by date string
  const navigateToNight = useCallback(
    (dateStr: string) => {
      const index = forecasts.findIndex(
        f => f.nightInfo.date.toISOString().split('T')[0] === dateStr
      );
      if (index !== -1) {
        setSelectedNightIndex(index);
        // Switch to week view on mobile so the table is visible
        if (activeTab === 'tonight') {
          setActiveTab('week');
        }
        // Scroll the table into view after a brief delay for view switch
        setTimeout(() => {
          nightTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    },
    [forecasts, activeTab, setActiveTab]
  );

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
    <main className="container mx-auto px-4 py-6 safe-area-inset">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-sky-400" />
            Sky Observation Forecast
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {formatDateRange(firstNight.nightInfo.date, lastNight.nightInfo.date)}
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-2 px-4 py-2 bg-night-800 hover:bg-night-700 text-white rounded-lg transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Tab Navigation (Mobile) */}
      <div className="flex sm:hidden gap-2 mb-6">
        <button
          type="button"
          onClick={() => setActiveTab('tonight')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'tonight'
              ? 'bg-sky-600 text-white'
              : 'bg-night-800 text-gray-400 hover:text-white'
          }`}
        >
          Tonight
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('week')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'week'
              ? 'bg-sky-600 text-white'
              : 'bg-night-800 text-gray-400 hover:text-white'
          }`}
        >
          {forecasts.length}-Day View
        </button>
      </div>

      {/* Best Nights Indicator */}
      {bestNights.length > 0 && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 text-green-400 text-sm font-medium mb-1">
            <Star className="w-4 h-4" />
            <Tooltip content="Nights ranked highest based on cloud cover, moon phase, transparency, and seeing conditions. Tap a date to see details.">
              <span className="border-b border-dotted border-green-500/50">
                Best Nights for Observation
              </span>
            </Tooltip>
          </div>
          <p className="text-gray-300 text-sm">
            {bestNights.slice(0, 3).map((dateStr, i) => {
              const date = new Date(dateStr);
              return (
                <span key={dateStr}>
                  {i > 0 && <span className="text-gray-500 mx-2">·</span>}
                  <button
                    type="button"
                    onClick={() => navigateToNight(dateStr)}
                    className="text-green-300 font-medium hover:text-green-200 hover:underline cursor-pointer transition-colors"
                  >
                    {formatDate(date)}
                  </button>
                </span>
              );
            })}
          </p>
        </div>
      )}

      {/* Night Summary Table (Desktop always, Mobile in week view) */}
      <div
        ref={nightTableRef}
        className={`mb-6 ${activeTab === 'tonight' ? 'hidden sm:block' : ''}`}
      >
        <NightSummaryTable
          forecasts={forecasts}
          selectedIndex={selectedNightIndex}
          onSelectNight={setSelectedNightIndex}
          bestNights={bestNights}
        />
      </div>

      {/* Weather Conditions (Mobile in tonight view, Desktop always) - Now first in Tonight tab */}
      <div className={`mb-6 ${activeTab === 'week' ? 'hidden sm:block' : ''}`}>
        <NightDetails forecast={selectedNight} />
      </div>

      {/* Sky Chart - Interactive sky map */}
      <div className={`mb-6 ${activeTab === 'week' ? 'hidden sm:block' : ''}`}>
        <SkyChart nightInfo={selectedNight.nightInfo} location={location} />
      </div>

      {/* Tonight's Highlights - Second in Tonight tab */}
      <div className={`mb-6 ${activeTab === 'week' ? 'hidden sm:block' : ''}`}>
        <TonightHighlights
          objects={selectedObjects}
          nightInfo={selectedNight.nightInfo}
          weather={selectedNight.weather}
          astronomicalEvents={selectedNight.astronomicalEvents}
          latitude={location.latitude}
        />
      </div>

      {/* Events Section (Conjunctions, Meteor Showers) */}
      <div className={`mb-6 ${activeTab === 'week' ? 'hidden sm:block' : ''}`}>
        <EventsSection
          conjunctions={selectedNight.conjunctions}
          meteorShowers={selectedNight.meteorShowers}
          astronomicalEvents={selectedNight.astronomicalEvents}
          latitude={location.latitude}
        />
      </div>

      {/* Satellite Passes Section */}
      <div className={`mb-6 ${activeTab === 'week' ? 'hidden sm:block' : ''}`}>
        <SatellitePassesCard nightInfo={selectedNight.nightInfo} location={location} />
      </div>
    </main>
  );
}
