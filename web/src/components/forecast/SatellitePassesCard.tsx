import { ChevronDown, ChevronRight, Rocket, Satellite } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  azimuthToCompass,
  calculateSatellitePasses,
  fetchISSTLE,
  formatPassDuration,
} from '@/lib/satellites';
import { formatTime } from '@/lib/utils/format';
import { useApp } from '@/stores/AppContext';
import type { Location, NightInfo, SatellitePass } from '@/types';

interface SatellitePassesCardProps {
  nightInfo: NightInfo;
  location: Location;
}

export default function SatellitePassesCard({ nightInfo, location }: SatellitePassesCardProps) {
  const { state } = useApp();
  const { settings } = state;
  const [expanded, setExpanded] = useState(false);
  const [passes, setPasses] = useState<SatellitePass[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showSatellitePasses = settings.showSatellitePasses;

  // Fetch passes when component mounts or night changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: location object is used for calculation
  useEffect(() => {
    // Skip fetching if disabled
    if (!showSatellitePasses) {
      return;
    }

    let cancelled = false;

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: async data fetching with error handling
    async function loadPasses() {
      setLoading(true);
      setError(null);

      try {
        const tle = await fetchISSTLE();
        if (!tle) {
          setError('TLE data unavailable');
          setPasses([]);
          return;
        }

        if (cancelled) return;

        const calculatedPasses = calculateSatellitePasses(tle, location, [nightInfo]);
        setPasses(calculatedPasses);
      } catch {
        if (!cancelled) {
          setError('Failed to calculate passes');
          setPasses([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPasses();

    return () => {
      cancelled = true;
    };
  }, [nightInfo.date.toISOString(), location.latitude, location.longitude, showSatellitePasses]);

  // Don't show if satellite passes are disabled
  if (!showSatellitePasses) {
    return null;
  }

  return (
    <div className="bg-night-900 rounded-xl border border-night-700 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-night-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">
            <Satellite className="w-6 h-6 text-sky-400" />
          </span>
          <h3 className="font-semibold text-white">ISS Passes</h3>
          {passes.length > 0 && (
            <span className="text-sm text-gray-400 bg-night-700 px-2 py-0.5 rounded-full">
              {passes.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="text-xs text-gray-500">Loading...</span>}
          {error && <span className="text-xs text-red-400">Unavailable</span>}
          {!loading && !error && passes.length === 0 && (
            <span className="text-xs text-gray-500">No visible passes tonight</span>
          )}
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Content */}
      {expanded && (
        <div className="border-t border-night-700 p-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sky-500" />
            </div>
          )}

          {error && (
            <div className="text-center py-4">
              <p className="text-gray-400 text-sm">{error}</p>
              <p className="text-gray-500 text-xs mt-1">
                Satellite pass data requires an internet connection
              </p>
            </div>
          )}

          {!loading && !error && passes.length === 0 && (
            <div className="text-center py-4">
              <Rocket className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">
                No ISS passes visible tonight from your location
              </p>
              <p className="text-gray-500 text-xs mt-1">
                Passes require dark skies and the ISS to be sunlit
              </p>
            </div>
          )}

          {!loading && !error && passes.length > 0 && (
            <div className="space-y-3">
              {passes.map((pass, index) => (
                <PassItem key={`${pass.riseTime.toISOString()}-${index}`} pass={pass} />
              ))}
              <p className="text-xs text-gray-500 text-center mt-4">
                Times shown are for your local timezone. The ISS appears as a bright, fast-moving
                star.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PassItem({ pass }: { pass: SatellitePass }) {
  return (
    <div className="bg-night-800 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Satellite className="w-4 h-4 text-sky-400" />
          <span className="font-medium text-white">{pass.satelliteName}</span>
        </div>
        {pass.magnitude !== null && (
          <span className="text-xs text-gray-400 bg-night-700 px-2 py-0.5 rounded">
            mag {pass.magnitude.toFixed(1)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <div className="text-xs text-gray-500 mb-1">Rise</div>
          <div className="text-gray-300">{formatTime(pass.riseTime)}</div>
          <div className="text-xs text-gray-500">
            {azimuthToCompass(pass.riseAzimuth)} ({pass.riseAzimuth.toFixed(0)}°)
          </div>
        </div>

        <div className="text-center">
          <div className="text-xs text-gray-500 mb-1">Max</div>
          <div className="text-sky-400 font-medium">{pass.maxAltitude.toFixed(0)}°</div>
          <div className="text-xs text-gray-500">@ {formatTime(pass.maxTime)}</div>
        </div>

        <div className="text-right">
          <div className="text-xs text-gray-500 mb-1">Set</div>
          <div className="text-gray-300">{formatTime(pass.setTime)}</div>
          <div className="text-xs text-gray-500">
            {azimuthToCompass(pass.setAzimuth)} ({pass.setAzimuth.toFixed(0)}°)
          </div>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-night-700 flex items-center justify-between text-xs text-gray-500">
        <span>Duration: {formatPassDuration(pass.duration)}</span>
        {pass.maxAltitude >= 60 && <span className="text-green-400">Excellent visibility</span>}
        {pass.maxAltitude >= 30 && pass.maxAltitude < 60 && (
          <span className="text-yellow-400">Good visibility</span>
        )}
        {pass.maxAltitude < 30 && <span className="text-orange-400">Low pass</span>}
      </div>
    </div>
  );
}
