import type { NightQuality } from '@/lib/weather/night-quality';

/** Same accessible opportunity rating on the overview and night selector. */
export default function NightRating({
  quality,
  compact = false,
}: {
  quality: NightQuality;
  compact?: boolean;
}) {
  const available = (quality.opportunity?.usableHours ?? 0) > 0;
  if (!available)
    return (
      <span className="text-gray-400 text-xs">
        {quality.summary === 'Opportunity unknown' ? 'Unknown' : 'No window'}
      </span>
    );
  return (
    <span
      className={`whitespace-nowrap ${quality.rating.color}`}
      role="img"
      aria-label={`Night opportunity: ${quality.rating.stars} out of 5`}
    >
      {quality.rating.starString}
      {!compact && ` ${quality.rating.label}`}
    </span>
  );
}
