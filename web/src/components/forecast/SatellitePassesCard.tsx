import { Globe, MapPin, Rocket, Satellite, Zap } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CountBadge, ToggleChevron } from '@/components/ui/Card';
import {
  azimuthToCompass,
  calculateMultiSatellitePasses,
  calculateSatellitePasses,
  fetchBrightSatelliteTLEs,
  fetchISSTLE,
  formatPassDuration,
} from '@/lib/satellites';
import {
  fetchISSPosition,
  formatISSAltitude,
  formatISSVelocity,
  getISSLocationName,
  getVisibilityDescription,
} from '@/lib/satellites/iss-position';
import { getAltitudeTextColor } from '@/lib/utils/colors';
import { formatTime, getNightLabel } from '@/lib/utils/format';
import { useApp } from '@/stores/AppContext';
import type { ISSPosition, Location, NightInfo, SatellitePass } from '@/types';

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
  const [showAllSatellites, setShowAllSatellites] = useState(false);

  // Real-time ISS position state
  const [issPosition, setIssPosition] = useState<ISSPosition | null>(null);
  const [issLocationName, setIssLocationName] = useState<string | null>(null);
  const [issPositionLoading, setIssPositionLoading] = useState(false);
  const positionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        if (showAllSatellites) {
          // Fetch bright satellites (includes ISS + Hubble + Tiangong + ~150 others)
          const tles = await fetchBrightSatelliteTLEs();
          if (cancelled) return;

          if (tles.length === 0) {
            setError('Satellite data unavailable');
            setPasses([]);
            return;
          }

          const calculatedPasses = calculateMultiSatellitePasses(tles, location, [nightInfo]);
          setPasses(calculatedPasses);
        } else {
          // ISS-only mode
          const tle = await fetchISSTLE();
          if (!tle) {
            setError('TLE data unavailable');
            setPasses([]);
            return;
          }

          if (cancelled) return;

          const calculatedPasses = calculateSatellitePasses(tle, location, [nightInfo]);
          setPasses(calculatedPasses);
        }
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
  }, [
    nightInfo.date.toISOString(),
    location.latitude,
    location.longitude,
    showSatellitePasses,
    showAllSatellites,
  ]);

  // Fetch ISS position when card is expanded
  const fetchPosition = useCallback(async () => {
    setIssPositionLoading(true);
    const position = await fetchISSPosition();
    setIssPosition(position);

    if (position) {
      const locationName = await getISSLocationName(position.latitude, position.longitude);
      setIssLocationName(locationName);
    }
    setIssPositionLoading(false);
  }, []);

  // Set up polling when expanded, pause when tab is hidden
  useEffect(() => {
    if (expanded && showSatellitePasses) {
      // Fetch immediately
      fetchPosition();

      // Set up 30-second interval
      positionIntervalRef.current = setInterval(fetchPosition, 30000);

      // Pause polling when tab is hidden to avoid stale requests
      const handleVisibility = () => {
        if (document.hidden) {
          if (positionIntervalRef.current) {
            clearInterval(positionIntervalRef.current);
            positionIntervalRef.current = null;
          }
        } else {
          fetchPosition();
          positionIntervalRef.current = setInterval(fetchPosition, 30000);
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibility);
        if (positionIntervalRef.current) {
          clearInterval(positionIntervalRef.current);
          positionIntervalRef.current = null;
        }
      };
    }

    // Clear interval when collapsed
    if (positionIntervalRef.current) {
      clearInterval(positionIntervalRef.current);
      positionIntervalRef.current = null;
    }
  }, [expanded, showSatellitePasses, fetchPosition]);

  // Don't show if satellite passes are disabled
  if (!showSatellitePasses) {
    return null;
  }

  const uniqueSatelliteCount = new Set(passes.map(p => p.noradId)).size;
  const headerLabel = showAllSatellites ? 'Satellite Passes' : 'ISS Passes';

  return (
    <Card>
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-night-800"
      >
        <div className="flex items-center gap-3">
          <Satellite className="h-6 w-6 text-sky-400" />
          <h3 className="font-semibold text-white">{headerLabel}</h3>
          {passes.length > 0 && <CountBadge count={passes.length} />}
          {showAllSatellites && uniqueSatelliteCount > 1 && (
            <span className="text-xs text-gray-500">{uniqueSatelliteCount} satellites</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="text-xs text-gray-500">Loading...</span>}
          {error && <span className="text-xs text-red-400">Unavailable</span>}
          {!loading && !error && passes.length === 0 && (
            <span className="text-xs text-gray-500">
              No visible passes {getNightLabel(nightInfo.date)}
            </span>
          )}
          <ToggleChevron expanded={expanded} />
        </div>
      </button>

      {/* Content */}
      {expanded && (
        <div className="border-t border-night-700 p-4">
          {/* Toggle between ISS-only and all satellites */}
          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAllSatellites(false)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                showAllSatellites
                  ? 'text-gray-400 hover:text-gray-300'
                  : 'bg-sky-500/20 text-sky-400'
              }`}
            >
              ISS Only
            </button>
            <button
              type="button"
              onClick={() => setShowAllSatellites(true)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                showAllSatellites
                  ? 'bg-sky-500/20 text-sky-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              All Bright Satellites
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-sky-500" />
            </div>
          )}

          {error && (
            <div className="py-4 text-center">
              <p className="text-sm text-gray-400">{error}</p>
              <p className="mt-1 text-xs text-gray-500">
                Satellite pass data requires an internet connection
              </p>
            </div>
          )}

          {!loading && !error && passes.length === 0 && (
            <div className="py-4 text-center">
              <Rocket className="mx-auto mb-2 h-8 w-8 text-gray-600" />
              <p className="text-sm text-gray-400">
                No {showAllSatellites ? 'satellite' : 'ISS'} passes visible{' '}
                {getNightLabel(nightInfo.date)} from your location
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Passes require dark skies and the satellite to be sunlit
              </p>
            </div>
          )}

          {!loading && !error && passes.length > 0 && (
            <div className="space-y-3">
              {passes.map((pass, index) => (
                <PassItem
                  key={`${pass.noradId}-${pass.riseTime.toISOString()}-${index}`}
                  pass={pass}
                />
              ))}
              <p className="mt-4 text-center text-xs text-gray-500">
                Times shown are for your local timezone.
                {showAllSatellites
                  ? ' Satellites appear as bright, fast-moving stars.'
                  : ' The ISS appears as a bright, fast-moving star.'}
              </p>
            </div>
          )}

          {/* Real-time ISS Position */}
          <ISSPositionDisplay
            position={issPosition}
            locationName={issLocationName}
            loading={issPositionLoading}
          />
        </div>
      )}
    </Card>
  );
}

function PassItem({ pass }: { pass: SatellitePass }) {
  return (
    <div className="rounded-lg bg-night-800 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Satellite className="h-4 w-4 text-sky-400" />
          <span className="font-medium text-white">{pass.satelliteName}</span>
        </div>
        {pass.magnitude !== null && (
          <span className="rounded bg-night-700 px-2 py-0.5 text-xs text-gray-400">
            mag {pass.magnitude.toFixed(1)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <div className="mb-1 text-xs text-gray-500">Rise</div>
          <div className="text-gray-300">{formatTime(pass.riseTime)}</div>
          <div className="text-xs text-gray-500">
            {azimuthToCompass(pass.riseAzimuth)} ({pass.riseAzimuth.toFixed(0)}&deg;)
          </div>
        </div>

        <div className="text-center">
          <div className="mb-1 text-xs text-gray-500">Max</div>
          <div className="font-medium text-sky-400">{pass.maxAltitude.toFixed(0)}&deg;</div>
          <div className="text-xs text-gray-500">@ {formatTime(pass.maxTime)}</div>
        </div>

        <div className="text-right">
          <div className="mb-1 text-xs text-gray-500">Set</div>
          <div className="text-gray-300">{formatTime(pass.setTime)}</div>
          <div className="text-xs text-gray-500">
            {azimuthToCompass(pass.setAzimuth)} ({pass.setAzimuth.toFixed(0)}&deg;)
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-night-700 pt-2 text-xs text-gray-500">
        <span>Duration: {formatPassDuration(pass.duration)}</span>
        <span className={getAltitudeTextColor(pass.maxAltitude)}>
          {pass.maxAltitude >= 60
            ? 'Excellent visibility'
            : pass.maxAltitude >= 30
              ? 'Good visibility'
              : 'Low pass'}
        </span>
      </div>
    </div>
  );
}

interface ISSPositionDisplayProps {
  position: ISSPosition | null;
  locationName: string | null;
  loading: boolean;
}

function ISSPositionDisplay({ position, locationName, loading }: ISSPositionDisplayProps) {
  if (loading && !position) {
    return (
      <div className="mt-4 border-t border-night-700 pt-4">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Globe className="h-4 w-4 animate-spin" />
          <span>Loading ISS position...</span>
        </div>
      </div>
    );
  }

  if (!position) {
    return null;
  }

  return (
    <div className="mt-4 border-t border-night-700 pt-4">
      <div className="mb-3 flex items-center gap-2">
        <Globe className="h-4 w-4 text-sky-400" />
        <span className="text-sm font-medium text-white">Current ISS Position</span>
        {loading && <span className="ml-auto text-xs text-gray-500">Updating...</span>}
      </div>

      <div className="space-y-2 rounded-lg bg-night-800 p-3">
        {/* Location */}
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-green-400" />
          <span className="text-sm text-gray-300">
            Currently over: <span className="font-medium text-white">{locationName}</span>
          </span>
        </div>

        {/* Coordinates */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500">Latitude: </span>
            <span className="text-gray-300">
              {Math.abs(position.latitude).toFixed(2)}&deg;{position.latitude >= 0 ? 'N' : 'S'}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Longitude: </span>
            <span className="text-gray-300">
              {Math.abs(position.longitude).toFixed(2)}&deg;{position.longitude >= 0 ? 'E' : 'W'}
            </span>
          </div>
        </div>

        {/* Altitude and Velocity */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500">Altitude: </span>
            <span className="text-gray-300">{formatISSAltitude(position.altitude)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-amber-400" />
            <span className="text-gray-300">{formatISSVelocity(position.velocity)}</span>
          </div>
        </div>

        {/* Visibility Status */}
        <div className="flex items-center gap-2 border-t border-night-700 pt-2">
          <div
            className={`h-2 w-2 rounded-full ${
              position.visibility === 'daylight' ? 'bg-yellow-400' : 'bg-gray-500'
            }`}
          />
          <span className="text-xs text-gray-400">
            {getVisibilityDescription(position.visibility)}
          </span>
          <span className="ml-auto text-xs text-gray-500">
            Updated {position.timestamp.toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
}
