import { Clock, CloudSun, Link, ShieldCheck } from 'lucide-react';
import { formatDurationMinutes } from '@/lib/utils/format';
import { getRatingFromPercentage } from '@/lib/utils/rating';
import type { NightQuality } from '@/lib/weather/night-quality';

export default function NightOpportunitySummary({ quality }: { quality: NightQuality }) {
  const opportunity = quality.opportunity;
  if (!opportunity) return null;
  const unknown = opportunity.label === 'Opportunity unknown';
  const items = [
    {
      Icon: CloudSun,
      label: 'Conditions',
      value: opportunity.usableHours
        ? getRatingFromPercentage(quality.conditionsScore).label
        : 'Unavailable',
    },
    {
      Icon: Clock,
      label: 'Usable time',
      value: unknown ? 'Unknown' : formatDurationMinutes(opportunity.usableHours * 60),
    },
    {
      Icon: Link,
      label: 'Longest block',
      value: unknown ? 'Unknown' : formatDurationMinutes(opportunity.longestHours * 60),
    },
    {
      Icon: ShieldCheck,
      label: 'Confidence',
      value:
        quality.confidence === 'high' ? 'High' : quality.confidence === 'medium' ? 'Medium' : 'Low',
    },
  ];
  return (
    <div
      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      role="group"
      aria-label="Night opportunity factors"
    >
      {items.map(({ Icon, label, value }) => (
        <div key={label} className="rounded-lg bg-night-800 px-3 py-2">
          <p className="flex items-center gap-1.5 text-gray-400 text-xs">
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {label}
          </p>
          <p className="mt-1 font-medium text-sky-100 text-sm tabular-nums">{value}</p>
        </div>
      ))}
    </div>
  );
}
