import { MapPin, RefreshCw, Settings, Telescope } from 'lucide-react';
import { useState } from 'react';
import BortleIndicator from '@/components/forecast/BortleIndicator';
import { formatCoordinates } from '@/lib/geo/location';
import { useApp } from '@/stores/AppContext';
import SettingsModal from './SettingsModal';

export default function Header() {
  const { state } = useApp();
  const { location, isLoading } = state;
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 bg-night-900/95 backdrop-blur-sm border-b border-night-700">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <Telescope className="w-6 h-6 text-sky-400" />
              <h1 className="text-lg font-semibold text-white">NightSeek</h1>
            </div>

            {/* Location (desktop) */}
            {location && (
              <div className="hidden sm:flex items-center gap-3 text-sm text-gray-400 min-w-0 flex-1 mx-4">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate max-w-[300px] lg:max-w-[400px]">
                    {location.name || formatCoordinates(location.latitude, location.longitude)}
                  </span>
                </div>
                <BortleIndicator latitude={location.latitude} longitude={location.longitude} />
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              {isLoading && <RefreshCw className="w-5 h-5 text-sky-400 animate-spin" />}
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="p-2 text-gray-400 hover:text-white hover:bg-night-700 rounded-lg transition-colors"
                aria-label="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Location (mobile) */}
          {location && (
            <div className="sm:hidden flex items-center justify-between mt-2">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <MapPin className="w-3 h-3" />
                <span className="truncate">
                  {location.name || formatCoordinates(location.latitude, location.longitude)}
                </span>
              </div>
              <BortleIndicator latitude={location.latitude} longitude={location.longitude} />
            </div>
          )}
        </div>
      </header>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}
