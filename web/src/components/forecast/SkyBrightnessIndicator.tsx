import Tooltip from '@/components/ui/Tooltip';
import { estimateBortle, explainBortleEstimate } from '@/lib/lightpollution/bortle-estimate';
import { SKY_ATLAS_YEAR } from '@/lib/lightpollution/sky-brightness';
import { useSkyBrightness } from '@/lib/lightpollution/useSkyBrightness';

export default function SkyBrightnessIndicator({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const { data, loading } = useSkyBrightness(latitude, longitude);
  const bortle = estimateBortle(data?.magnitudes ?? null);
  const text = data
    ? `${data.magnitudes.toFixed(1)} mag/arcsec²`
    : loading
      ? 'Sky loading…'
      : 'Sky unavailable';
  const tooltip = data
    ? `${explainBortleEstimate(data.magnitudes)}\n\nDavid Lorenz ${SKY_ATLAS_YEAR} atlas · ~1 km · modeled moonless baseline, not tonight’s conditions.`
    : loading
      ? 'Loading regional sky-brightness data.'
      : 'Sky-brightness data is unavailable for this location. No guessed rating is substituted. Connect to the internet to load a new region.';
  return (
    <Tooltip content={tooltip} maxWidth={300}>
      <span
        className="inline-flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-sky-500/10 px-2 py-0.5 font-medium text-sky-200 text-xs"
        role="img"
        aria-label={tooltip}
      >
        <SkyBrightnessIcon />
        <span className="flex flex-col leading-tight sm:flex-row sm:items-center sm:gap-2">
          {bortle !== null && <span>Bortle {bortle.toFixed(1)}</span>}
          <span className={bortle === null ? undefined : 'text-sky-200/80'}>{text}</span>
        </span>
      </span>
    </Tooltip>
  );
}

function SkyBrightnessIcon() {
  return (
    <svg
      className="h-3 w-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="8" opacity={0.5} />
      <circle cx="12" cy="12" r="11" opacity={0.25} />
    </svg>
  );
}
