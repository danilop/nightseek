import { Activity, Sun, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { getGeomagneticLabel, getKpColorClass } from '@/lib/nasa/donki';
import {
  fetchSWPCData,
  getCurrentKp,
  getRecentMaxKp,
  getSolarActivityLabel,
  getTodayFlareProbability,
  type SWPCData,
} from '@/lib/nasa/swpc';
import { formatTime } from '@/lib/utils/format';
import type { AuroraForecast, SpaceWeather } from '@/types';

interface SpaceWeatherCardProps {
  spaceWeather: SpaceWeather;
  auroraForecast: AuroraForecast | null;
}

export default function SpaceWeatherCard({ spaceWeather, auroraForecast }: SpaceWeatherCardProps) {
  const { geomagneticStorms, solarFlares } = spaceWeather;
  const [swpcData, setSwpcData] = useState<SWPCData | null>(null);

  useEffect(() => {
    fetchSWPCData()
      .then(setSwpcData)
      .catch(() => {});
  }, []);

  // Use live Kp from SWPC if available, fall back to DONKI
  const liveKp = swpcData ? getCurrentKp(swpcData) : null;
  const recentMaxKp = swpcData ? getRecentMaxKp(swpcData) : null;
  const overallMaxKp =
    recentMaxKp ?? geomagneticStorms.reduce((max, storm) => Math.max(max, storm.maxKp), 0);

  const displayKp = liveKp ?? overallMaxKp;
  const geoLabel = getGeomagneticLabel(displayKp);
  const kpColor = getKpColorClass(displayKp);

  // Solar flare probabilities from SWPC
  const flareForecast = swpcData ? getTodayFlareProbability(swpcData) : null;
  const solarFluxValue = swpcData?.solarFlux?.flux ?? null;
  const solarActivityLabel = getSolarActivityLabel(solarFluxValue);

  return (
    <Card>
      <div className="border-night-700 border-b px-4 py-3">
        <h3 className="flex items-center gap-2 font-semibold text-white">
          <Zap className="h-4 w-4 text-purple-400" />
          Space Weather
          {swpcData && <span className="ml-auto font-normal text-green-500 text-xs">Live</span>}
        </h3>
      </div>
      <div className="space-y-3 p-4">
        {/* Geomagnetic Activity Level */}
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm">Geomagnetic Activity</span>
          <div className="flex items-center gap-2">
            <span className={`font-medium text-sm capitalize ${kpColor}`}>{geoLabel}</span>
            <Badge variant={displayKp >= 5 ? 'danger' : displayKp >= 3 ? 'warning' : 'default'}>
              Kp {displayKp}
            </Badge>
          </div>
        </div>

        {/* Live vs Recent Kp (only show when SWPC data present) */}
        {liveKp !== null && recentMaxKp !== null && recentMaxKp > liveKp && (
          <div className="flex items-center justify-between text-gray-500 text-xs">
            <span>24h max Kp</span>
            <span className={getKpColorClass(recentMaxKp)}>Kp {recentMaxKp}</span>
          </div>
        )}

        {/* Solar Activity / F10.7 Flux */}
        {solarFluxValue !== null && (
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">Solar Activity</span>
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-orange-400" />
              <span className="text-gray-300 text-sm capitalize">{solarActivityLabel}</span>
              <span className="text-gray-500 text-xs">F10.7: {solarFluxValue.toFixed(0)}</span>
            </div>
          </div>
        )}

        {/* Flare Probability Forecast (SWPC) */}
        {flareForecast &&
          (flareForecast.mClassProbability > 0 || flareForecast.xClassProbability > 0) && (
            <div>
              <p className="mb-2 text-gray-500 text-xs">Flare Probability (today)</p>
              <div className="flex items-center gap-3 text-sm">
                {flareForecast.mClassProbability > 0 && (
                  <span className="text-yellow-400">
                    M-class: {flareForecast.mClassProbability}%
                  </span>
                )}
                {flareForecast.xClassProbability > 0 && (
                  <span className="text-red-400">X-class: {flareForecast.xClassProbability}%</span>
                )}
              </div>
            </div>
          )}

        {/* Sunspot Regions */}
        {swpcData && swpcData.sunspotRegions.length > 0 && (
          <div>
            <p className="mb-2 text-gray-500 text-xs">
              Active Regions ({swpcData.sunspotRegions.length})
            </p>
            <div className="space-y-1">
              {swpcData.sunspotRegions.slice(0, 3).map((region, i) => (
                <div
                  key={`${region.region}-${i}`}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-gray-400">AR {region.region}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-300">
                      {region.spotCount} {region.spotCount === 1 ? 'spot' : 'spots'}
                    </span>
                    {region.magClass && (
                      <span className="text-gray-500 text-xs">{region.magClass}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Storms (from DONKI) */}
        {geomagneticStorms.length > 0 && (
          <div>
            <p className="mb-2 text-gray-500 text-xs">Recent Storms</p>
            <div className="space-y-2">
              {geomagneticStorms.slice(0, 3).map(storm => (
                <div key={storm.gstID} className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">
                    {new Date(storm.startTime).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={getKpColorClass(storm.maxKp)}>Max Kp {storm.maxKp}</span>
                    <span className="text-gray-500 text-xs">
                      {formatTime(new Date(storm.startTime))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Solar Flares (from DONKI) */}
        {solarFlares.length > 0 && (
          <div>
            <p className="mb-2 text-gray-500 text-xs">Significant Solar Flares</p>
            <div className="space-y-2">
              {solarFlares.slice(0, 3).map(flare => (
                <div key={flare.flrID} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Sun className="h-3.5 w-3.5 text-yellow-400" />
                    <span className="text-gray-300">{flare.classType}</span>
                  </div>
                  <span className="text-gray-500 text-xs">
                    {new Date(flare.peakTime).toLocaleDateString()}{' '}
                    {formatTime(new Date(flare.peakTime))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Aurora Potential */}
        {auroraForecast && (
          <div className="border-night-700 border-t pt-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Aurora Potential</span>
              <AuroraChanceBadge chance={auroraForecast.chance} />
            </div>
            {auroraForecast.chance !== 'none' && (
              <p className="mt-1 text-gray-500 text-xs">
                Need Kp {auroraForecast.requiredKp}+ at your latitude
              </p>
            )}
          </div>
        )}

        {/* Empty state */}
        {geomagneticStorms.length === 0 && solarFlares.length === 0 && !swpcData && (
          <p className="text-gray-500 text-sm">No significant space weather activity detected.</p>
        )}
      </div>
    </Card>
  );
}

function AuroraChanceBadge({ chance }: { chance: string }) {
  const config: Record<
    string,
    { label: string; variant: 'success' | 'warning' | 'info' | 'default' }
  > = {
    certain: { label: 'Aurora Certain', variant: 'success' },
    likely: { label: 'Aurora Likely', variant: 'success' },
    possible: { label: 'Aurora Possible', variant: 'warning' },
    unlikely: { label: 'Unlikely', variant: 'info' },
    none: { label: 'None', variant: 'default' },
  };

  const { label, variant } = config[chance] ?? config.none;
  return <Badge variant={variant}>{label}</Badge>;
}
