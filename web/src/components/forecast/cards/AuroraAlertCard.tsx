import { Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { fetchSWPCData, getCurrentKp, type SWPCData } from '@/lib/nasa/swpc';
import type { AuroraForecast } from '@/types';

interface AuroraAlertCardProps {
  forecast: AuroraForecast;
}

export default function AuroraAlertCard({ forecast }: AuroraAlertCardProps) {
  const [swpcData, setSwpcData] = useState<SWPCData | null>(null);

  useEffect(() => {
    fetchSWPCData()
      .then(setSwpcData)
      .catch(() => {});
  }, []);

  // Only show when chance >= 'possible'
  if (forecast.chance === 'none' || forecast.chance === 'unlikely') {
    return null;
  }

  const isHigh = forecast.chance === 'certain' || forecast.chance === 'likely';

  const borderClass = isHigh
    ? 'bg-green-500/10 border-green-500/30'
    : 'bg-amber-500/10 border-amber-500/30';

  const glowClass = isHigh ? 'text-green-400' : 'text-amber-400';

  const chanceBadge: Record<string, { label: string; variant: 'success' | 'warning' }> = {
    certain: { label: 'Certain', variant: 'success' },
    likely: { label: 'Likely', variant: 'success' },
    possible: { label: 'Possible', variant: 'warning' },
  };

  const badge = chanceBadge[forecast.chance];
  const liveKp = swpcData ? getCurrentKp(swpcData) : null;
  const displayKp = liveKp ?? forecast.currentMaxKp;

  return (
    <div className={`rounded-xl border p-4 ${borderClass}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className={`h-5 w-5 ${glowClass}`} />
          <h3 className="font-semibold text-white">Aurora Alert</h3>
          {liveKp !== null && <span className="text-green-500 text-xs">Live</span>}
        </div>
        {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
      </div>
      <p className="text-gray-300 text-sm">{forecast.description}</p>
      <div className="mt-2 flex items-center gap-4 text-gray-400 text-xs">
        <span>
          Current Kp: <strong className={glowClass}>{displayKp}</strong>
        </span>
        <span>Required Kp: {forecast.requiredKp}</span>
      </div>
    </div>
  );
}
