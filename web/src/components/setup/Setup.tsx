import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Search, Loader2 } from 'lucide-react';
import { useApp } from '@/stores/AppContext';
import {
  detectLocationByIP,
  detectLocationByBrowser,
  geocodeAddress,
  reverseGeocode,
  validateCoordinates,
} from '@/lib/geo/location';
import type { Location } from '@/types';

type SetupMode = 'choose' | 'detect' | 'search' | 'manual';

export default function Setup() {
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

    setIsLoading(false);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-md">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-sky-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <MapPin className="w-8 h-8 text-sky-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Set Your Location</h2>
        <p className="text-gray-400">
          NightSeek needs your location to calculate accurate astronomical data
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-6 text-sm text-red-400">
          {error}
        </div>
      )}

      {mode === 'choose' && (
        <div className="space-y-3">
          {/* Use detected location */}
          {detectedLocation && (
            <button
              onClick={handleUseDetected}
              className="w-full flex items-center gap-3 p-4 bg-sky-600 hover:bg-sky-500 text-white rounded-xl transition-colors"
            >
              <Navigation className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">Use Detected Location</div>
                <div className="text-sm text-sky-200">{detectedLocation.name}</div>
              </div>
            </button>
          )}

          {/* Precise location */}
          <button
            onClick={handleBrowserDetect}
            disabled={isLoading}
            className="w-full flex items-center gap-3 p-4 bg-night-800 hover:bg-night-700 text-white rounded-xl border border-night-600 transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Navigation className="w-5 h-5 text-sky-400" />
            )}
            <div className="text-left">
              <div className="font-medium">Use Precise Location</div>
              <div className="text-sm text-gray-400">Requires location permission</div>
            </div>
          </button>

          {/* Search */}
          <button
            onClick={() => setMode('search')}
            className="w-full flex items-center gap-3 p-4 bg-night-800 hover:bg-night-700 text-white rounded-xl border border-night-600 transition-colors"
          >
            <Search className="w-5 h-5 text-sky-400" />
            <div className="text-left">
              <div className="font-medium">Search for Location</div>
              <div className="text-sm text-gray-400">Enter city, address, or place name</div>
            </div>
          </button>

          {/* Manual */}
          <button
            onClick={() => setMode('manual')}
            className="w-full flex items-center gap-3 p-4 bg-night-800 hover:bg-night-700 text-white rounded-xl border border-night-600 transition-colors"
          >
            <MapPin className="w-5 h-5 text-sky-400" />
            <div className="text-left">
              <div className="font-medium">Enter Coordinates</div>
              <div className="text-sm text-gray-400">Latitude and longitude</div>
            </div>
          </button>
        </div>
      )}

      {mode === 'search' && (
        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Search Location
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter city, address, or place..."
              className="w-full px-4 py-3 bg-night-800 border border-night-600 rounded-xl text-white placeholder-gray-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
              autoFocus
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setMode('choose')}
              className="flex-1 py-3 bg-night-700 hover:bg-night-600 text-white rounded-xl transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isLoading || !searchQuery.trim()}
              className="flex-1 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Search className="w-5 h-5" />
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
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Latitude
            </label>
            <input
              type="number"
              step="any"
              value={manualLat}
              onChange={(e) => setManualLat(e.target.value)}
              placeholder="-90 to 90"
              className="w-full px-4 py-3 bg-night-800 border border-night-600 rounded-xl text-white placeholder-gray-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Longitude
            </label>
            <input
              type="number"
              step="any"
              value={manualLon}
              onChange={(e) => setManualLon(e.target.value)}
              placeholder="-180 to 180"
              className="w-full px-4 py-3 bg-night-800 border border-night-600 rounded-xl text-white placeholder-gray-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setMode('choose')}
              className="flex-1 py-3 bg-night-700 hover:bg-night-600 text-white rounded-xl transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isLoading || !manualLat || !manualLon}
              className="flex-1 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Save Location'
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
