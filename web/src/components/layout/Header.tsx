import { MapPin, RefreshCw, Search, Settings } from 'lucide-react';
import { useState } from 'react';
import BortleIndicator from '@/components/forecast/BortleIndicator';
import ObjectSearchModal from '@/components/search/ObjectSearchModal';
import NightSeekIcon from '@/components/ui/NightSeekIcon';
import { formatCoordinates } from '@/lib/geo/location';
import { useApp } from '@/stores/AppContext';
import AboutDialog from './AboutDialog';
import SettingsModal from './SettingsModal';

export default function Header() {
  const { state } = useApp();
  const { location, isLoading } = state;
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 border-night-700 border-b bg-night-900/95 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <button
              type="button"
              onClick={() => setShowAbout(true)}
              className="flex items-center gap-2 transition-opacity hover:opacity-80"
            >
              <NightSeekIcon className="h-7 w-7" />
              <h1 className="font-semibold text-lg text-white">NightSeek</h1>
            </button>

            {/* Location (desktop) */}
            {location && (
              <div className="mx-4 hidden flex-1 items-center justify-end gap-3 text-gray-400 text-sm sm:flex">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span className="text-right">
                    {(location.name || formatCoordinates(location.latitude, location.longitude))
                      .split(',')
                      .map((part, i, arr) => (
                        <span key={part} className="whitespace-nowrap">
                          {part.trim()}
                          {i < arr.length - 1 && ','}
                          {i < arr.length - 1 && ' '}
                        </span>
                      ))}
                  </span>
                </div>
                <BortleIndicator latitude={location.latitude} longitude={location.longitude} />
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              {isLoading && <RefreshCw className="h-5 w-5 animate-spin text-sky-400" />}
              {location && (
                <button
                  type="button"
                  onClick={() => setShowSearch(true)}
                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-night-700 hover:text-white"
                  aria-label="Search objects"
                  title="Search celestial objects"
                >
                  <Search className="h-5 w-5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-night-700 hover:text-white"
                aria-label="Settings"
              >
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Location (mobile) */}
          {location && (
            <div className="mt-2 flex items-center justify-between sm:hidden">
              <div className="flex items-center gap-2 text-gray-400 text-xs">
                <MapPin className="h-3 w-3" />
                <span className="truncate">
                  {location.name || formatCoordinates(location.latitude, location.longitude)}
                </span>
              </div>
              <BortleIndicator latitude={location.latitude} longitude={location.longitude} />
            </div>
          )}
        </div>
      </header>

      {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showSearch && location && (
        <ObjectSearchModal location={location} onClose={() => setShowSearch(false)} />
      )}
    </>
  );
}
