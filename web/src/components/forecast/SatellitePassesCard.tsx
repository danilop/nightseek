import { Globe, MapPin, Rocket, Satellite, Zap } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CountBadge, ToggleChevron } from '@/components/ui/Card';
import {
  azimuthToCompass,
  calculateSatellitePasses,
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

  // Set up polling when expanded
  useEffect(() => {
    if (expanded && showSatellitePasses) {
      // Fetch immediately
      fetchPosition();

      // Set up 30-second interval
      positionIntervalRef.current = setInterval(fetchPosition, 30000);

      return () => {
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

  return (
    <Card>
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-night-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Satellite className="w-6 h-6 text-sky-400" />
          <h3 className="font-semibold text-white">ISS Passes</h3>
          {passes.length > 0 && <CountBadge count={passes.length} />}
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
                No ISS passes visible {getNightLabel(nightInfo.date)} from your
                location
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
      <div className="mt-4 pt-4 border-t border-night-700">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Globe className="w-4 h-4 animate-spin" />
          <span>Loading ISS position...</span>
        </div>
      </div>
    );
  }

  if (!position) {
    return null;
  }

  return (
    <div className="mt-4 pt-4 border-t border-night-700">
      <div className="flex items-center gap-2 mb-3">
        <Globe className="w-4 h-4 text-sky-400" />
        <span className="text-sm font-medium text-white">Current ISS Position</span>
        {loading && <span className="text-xs text-gray-500 ml-auto">Updating...</span>}
      </div>

      <div className="bg-night-800 rounded-lg p-3 space-y-2">
        {/* Location */}
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-green-400" />
          <span className="text-sm text-gray-300">
            Currently over: <span className="text-white font-medium">{locationName}</span>
          </span>
        </div>

        {/* Coordinates */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500">Latitude: </span>
            <span className="text-gray-300">
              {Math.abs(position.latitude).toFixed(2)}°{position.latitude >= 0 ? 'N' : 'S'}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Longitude: </span>
            <span className="text-gray-300">
              {Math.abs(position.longitude).toFixed(2)}°{position.longitude >= 0 ? 'E' : 'W'}
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
            <Zap className="w-3 h-3 text-amber-400" />
            <span className="text-gray-300">{formatISSVelocity(position.velocity)}</span>
          </div>
        </div>

        {/* Visibility Status */}
        <div className="flex items-center gap-2 pt-2 border-t border-night-700">
          <div
            className={`w-2 h-2 rounded-full ${
              position.visibility === 'daylight' ? 'bg-yellow-400' : 'bg-gray-500'
            }`}
          />
          <span className="text-xs text-gray-400">
            {getVisibilityDescription(position.visibility)}
          </span>
          <span className="text-xs text-gray-500 ml-auto">
            Updated {position.timestamp.toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
}
