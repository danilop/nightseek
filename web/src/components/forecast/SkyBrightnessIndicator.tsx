import Tooltip from '@/components/ui/Tooltip';
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
  const text = data
    ? `Sky ${data.magnitudes.toFixed(1)}`
    : loading
      ? 'Sky loading…'
      : 'Sky unavailable';
  const tooltip = data
    ? `Estimated zenith sky brightness: ${data.magnitudes.toFixed(1)} mag/arcsec². Higher means darker.\n\nDavid Lorenz ${SKY_ATLAS_YEAR} atlas · roughly 1 km resolution. A modeled moonless baseline, not a measurement or Bortle class. Local lights and tonight’s atmosphere can change actual conditions.`
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
        <span>{text}</span>
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
