import { Coffee, Loader2, MapPin, Navigation, Search } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import NightSeekIcon from '@/components/ui/NightSeekIcon';
import {
  detectLocationByBrowser,
  detectLocationByIP,
  geocodeAddress,
  reverseGeocode,
  validateCoordinates,
} from '@/lib/geo/location';
import { useApp } from '@/stores/AppContext';
import type { Location } from '@/types';
import { APP_VERSION } from '@/version';

type SetupMode = 'choose' | 'detect' | 'search' | 'manual';

interface SetupProps {
  onLocationSet?: () => void;
}

export default function Setup({ onLocationSet }: SetupProps) {
  const { setLocation } = useApp();
  const [mode, setMode] = useState<SetupMode>('choose');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedLocation, setDetectedLocation] = useState<Location | null>(null);

  // Search mode state
  const [searchQuery, setSearchQuery] = useState('');

  // Manual mode state
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');

  // Auto-detect location on mount
  useEffect(() => {
    async function autoDetect() {
      setIsLoading(true);
      try {
        // Try IP-based detection first (faster, no permission needed)
        const ipLocation = await detectLocationByIP();
        if (ipLocation) {
          setDetectedLocation(ipLocation);
        }
      } catch {
        // Ignore errors
      }
      setIsLoading(false);
    }

    autoDetect();
  }, []);

  const handleUseDetected = async () => {
    if (detectedLocation) {
      await setLocation(detectedLocation);
      onLocationSet?.();
    }
  };

  const handleBrowserDetect = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const browserLocation = await detectLocationByBrowser();
      if (browserLocation) {
        // Try to get place name
        const name = await reverseGeocode(browserLocation.latitude, browserLocation.longitude);
        const location: Location = {
          ...browserLocation,
          name: name || undefined,
        };
        await setLocation(location);
        onLocationSet?.();
      } else {
        setError('Could not detect your location. Please allow location access or enter manually.');
      }
    } catch {
      setError('Location detection failed. Please try another method.');
    }

    setIsLoading(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const location = await geocodeAddress(searchQuery);
      if (location) {
        await setLocation(location);
        onLocationSet?.();
      } else {
        setError('Could not find that location. Please try a different search.');
      }
    } catch {
      setError('Search failed. Please try again.');
    }

    setIsLoading(false);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const lat = parseFloat(manualLat);
    const lon = parseFloat(manualLon);

    if (!validateCoordinates(lat, lon)) {
      setError('Invalid coordinates. Latitude must be -90 to 90, longitude -180 to 180.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Try to get place name
      const name = await reverseGeocode(lat, lon);
      await setLocation({
        latitude: lat,
        longitude: lon,
        name: name || undefined,
      });
    } catch {
      await setLocation({
        latitude: lat,
        longitude: lon,
      });
    }

    onLocationSet?.();
    setIsLoading(false);
  };

  return (
    <div className="container mx-auto max-w-md px-4 py-8">
      <div className="mb-8 text-center">
        <NightSeekIcon className="mx-auto mb-4 h-20 w-20" />
        <h2 className="mb-2 font-bold text-2xl text-white">Set Your Location</h2>
        <p className="text-gray-400">
          NightSeek needs your location to calculate accurate astronomical data
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {mode === 'choose' && (
        <div className="space-y-3">
          {/* Use detected location */}
          {detectedLocation && (
            <button
              type="button"
              onClick={handleUseDetected}
              className="flex w-full items-center gap-3 rounded-xl bg-sky-600 p-4 text-white transition-colors hover:bg-sky-500"
            >
              <Navigation className="h-5 w-5" />
              <div className="text-left">
                <div className="font-medium">Use Detected Location</div>
                <div className="text-sky-200 text-sm">{detectedLocation.name}</div>
              </div>
            </button>
          )}

          {/* Precise location */}
          <button
            type="button"
            onClick={handleBrowserDetect}
            disabled={isLoading}
            className="flex w-full items-center gap-3 rounded-xl border border-night-600 bg-night-800 p-4 text-white transition-colors hover:bg-night-700 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Navigation className="h-5 w-5 text-sky-400" />
            )}
            <div className="text-left">
              <div className="font-medium">Use Precise Location</div>
              <div className="text-gray-400 text-sm">Requires location permission</div>
            </div>
          </button>

          {/* Search */}
          <button
            type="button"
            onClick={() => setMode('search')}
            className="flex w-full items-center gap-3 rounded-xl border border-night-600 bg-night-800 p-4 text-white transition-colors hover:bg-night-700"
          >
            <Search className="h-5 w-5 text-sky-400" />
            <div className="text-left">
              <div className="font-medium">Search for Location</div>
              <div className="text-gray-400 text-sm">Enter city, address, or place name</div>
            </div>
          </button>

          {/* Manual */}
          <button
            type="button"
            onClick={() => setMode('manual')}
            className="flex w-full items-center gap-3 rounded-xl border border-night-600 bg-night-800 p-4 text-white transition-colors hover:bg-night-700"
          >
            <MapPin className="h-5 w-5 text-sky-400" />
            <div className="text-left">
              <div className="font-medium">Enter Coordinates</div>
              <div className="text-gray-400 text-sm">Latitude and longitude</div>
            </div>
          </button>
        </div>
      )}

      {mode === 'search' && (
        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label
              htmlFor="search-location"
              className="mb-2 block font-medium text-gray-300 text-sm"
            >
              Search Location
            </label>
            <input
              id="search-location"
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Enter city, address, or place..."
              className="w-full rounded-xl border border-night-600 bg-night-800 px-4 py-3 text-white placeholder-gray-500 transition-colors focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setMode('choose')}
              className="flex-1 rounded-xl bg-night-700 py-3 text-white transition-colors hover:bg-night-600"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isLoading || !searchQuery.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-600 py-3 text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Search className="h-5 w-5" />
                  Search
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {mode === 'manual' && (
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="manual-latitude"
              className="mb-2 block font-medium text-gray-300 text-sm"
            >
              Latitude
            </label>
            <input
              id="manual-latitude"
              type="number"
              step="any"
              value={manualLat}
              onChange={e => setManualLat(e.target.value)}
              placeholder="-90 to 90"
              className="w-full rounded-xl border border-night-600 bg-night-800 px-4 py-3 text-white placeholder-gray-500 transition-colors focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div>
            <label
              htmlFor="manual-longitude"
              className="mb-2 block font-medium text-gray-300 text-sm"
            >
              Longitude
            </label>
            <input
              id="manual-longitude"
              type="number"
              step="any"
              value={manualLon}
              onChange={e => setManualLon(e.target.value)}
              placeholder="-180 to 180"
              className="w-full rounded-xl border border-night-600 bg-night-800 px-4 py-3 text-white placeholder-gray-500 transition-colors focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setMode('choose')}
              className="flex-1 rounded-xl bg-night-700 py-3 text-white transition-colors hover:bg-night-600"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isLoading || !manualLat || !manualLon}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-600 py-3 text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Save Location'}
            </button>
          </div>
        </form>
      )}

      {/* Footer */}
      <div className="mt-10 flex items-center justify-center gap-1.5 text-gray-600 text-xs">
        <span>v{APP_VERSION}</span>
        <span>·</span>
        <span>Danilo Poccia</span>
        <span>·</span>
        <a
          href="https://buymeacoffee.com/danilop"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-gray-600 transition-colors hover:text-amber-400"
        >
          <Coffee className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
