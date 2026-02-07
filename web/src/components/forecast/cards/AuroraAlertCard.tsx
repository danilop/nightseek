import { Zap } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import type { AuroraForecast } from '@/types';

interface AuroraAlertCardProps {
  forecast: AuroraForecast;
}

export default function AuroraAlertCard({ forecast }: AuroraAlertCardProps) {
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

  return (
    <div className={`rounded-xl border p-4 ${borderClass}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Zap className={`w-5 h-5 ${glowClass}`} />
          <h3 className="font-semibold text-white">Aurora Alert</h3>
        </div>
        {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
      </div>
      <p className="text-sm text-gray-300">{forecast.description}</p>
      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
        <span>
          Current Kp: <strong className={glowClass}>{forecast.currentMaxKp}</strong>
        </span>
        <span>Required Kp: {forecast.requiredKp}</span>
      </div>
    </div>
  );
}
