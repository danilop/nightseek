import { Sun, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { getGeomagneticLabel, getKpColorClass } from '@/lib/nasa/donki';
import { formatTime } from '@/lib/utils/format';
import type { AuroraForecast, SpaceWeather } from '@/types';

interface SpaceWeatherCardProps {
  spaceWeather: SpaceWeather;
  auroraForecast: AuroraForecast | null;
}

export default function SpaceWeatherCard({ spaceWeather, auroraForecast }: SpaceWeatherCardProps) {
  const { geomagneticStorms, solarFlares } = spaceWeather;

  // Find the overall max Kp across all storms
  const overallMaxKp = geomagneticStorms.reduce((max, storm) => Math.max(max, storm.maxKp), 0);

  const geoLabel = getGeomagneticLabel(overallMaxKp);
  const kpColor = getKpColorClass(overallMaxKp);

  return (
    <Card>
      <div className="px-4 py-3 border-b border-night-700">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Zap className="w-4 h-4 text-purple-400" />
          Space Weather
        </h3>
      </div>
      <div className="p-4 space-y-3">
        {/* Geomagnetic Activity Level */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Geomagnetic Activity</span>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium capitalize ${kpColor}`}>{geoLabel}</span>
            <Badge
              variant={overallMaxKp >= 5 ? 'danger' : overallMaxKp >= 3 ? 'warning' : 'default'}
            >
              Kp {overallMaxKp}
            </Badge>
          </div>
        </div>

        {/* Recent Storms */}
        {geomagneticStorms.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-2">Recent Storms</p>
            <div className="space-y-2">
              {geomagneticStorms.slice(0, 3).map(storm => (
                <div key={storm.gstID} className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">
                    {new Date(storm.startTime).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={getKpColorClass(storm.maxKp)}>Max Kp {storm.maxKp}</span>
                    <span className="text-xs text-gray-500">
                      {formatTime(new Date(storm.startTime))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Solar Flares */}
        {solarFlares.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-2">Significant Solar Flares</p>
            <div className="space-y-2">
              {solarFlares.slice(0, 3).map(flare => (
                <div key={flare.flrID} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Sun className="w-3.5 h-3.5 text-yellow-400" />
                    <span className="text-gray-300">{flare.classType}</span>
                  </div>
                  <span className="text-xs text-gray-500">
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
          <div className="pt-2 border-t border-night-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Aurora Potential</span>
              <AuroraChanceBadge chance={auroraForecast.chance} />
            </div>
            {auroraForecast.chance !== 'none' && (
              <p className="text-xs text-gray-500 mt-1">
                Need Kp {auroraForecast.requiredKp}+ at your latitude
              </p>
            )}
          </div>
        )}

        {/* Empty state */}
        {geomagneticStorms.length === 0 && solarFlares.length === 0 && (
          <p className="text-sm text-gray-500">No significant space weather activity detected.</p>
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
