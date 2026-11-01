import { formatMagnitude } from '@/lib/utils/format';
import { hasMagnitude } from '@/lib/utils/magnitude';

/** A compact, always-visible brightness label; missing values remain explicit. */
export default function Magnitude({
  value,
  estimated = false,
  source,
}: {
  value: number | null | undefined;
  estimated?: boolean;
  source?: string;
}) {
  const known = hasMagnitude(value);
  const label = `${estimated && known ? 'est. ' : ''}mag ${formatMagnitude(known ? value : null)}`;
  return (
    <span
      data-testid="target-magnitude"
      className="inline-block whitespace-nowrap rounded bg-night-700/70 px-1.5 py-0.5 font-normal text-gray-300 text-xs tabular-nums"
      title={
        known
          ? `${source ? `${source} · ` : ''}Apparent magnitude · lower numbers are brighter`
          : 'Apparent magnitude unavailable'
      }
    >
      <span aria-hidden="true">{label}</span>
      <span className="sr-only">
        {known
          ? `${estimated ? 'Estimated magnitude' : 'Magnitude'} ${formatMagnitude(value)}`
          : 'Magnitude unknown'}
      </span>
    </span>
  );
}
