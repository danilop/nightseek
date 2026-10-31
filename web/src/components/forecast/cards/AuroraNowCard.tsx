import { Body } from 'astronomy-engine';
import { useEffect, useMemo, useState } from 'react';
import { useCurrentTime } from '@/hooks/useCurrentTime';
import { SkyCalculator } from '@/lib/astronomy/calculator';
import {
  fetchOvation,
  fetchSolarWind,
  localOvation,
  type Ovation,
  type SolarWindReading,
} from '@/lib/nasa/aurora-now';
import type { Location, NightWeather } from '@/types';

export default function AuroraNowCard({
  location,
  weather,
}: {
  location: Location;
  weather: NightWeather | null;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{
    ovation: Ovation | null;
    bz: SolarWindReading | null;
    speed: SolarWindReading | null;
  } | null>(null);
  const now = useCurrentTime();
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void Promise.all([fetchOvation(), fetchSolarWind()]).then(([ovation, wind]) => {
      if (!cancelled) setData({ ovation, ...wind });
    });
    return () => {
      cancelled = true;
    };
  }, [open]);
  const minute = Math.floor(now.getTime() / 60_000);
  const local = useMemo(
    () =>
      data?.ovation
        ? localOvation(data.ovation, location.latitude, location.longitude, minute * 60_000)
        : null,
    [data?.ovation, location.latitude, location.longitude, minute]
  );
  const calc = new SkyCalculator(location.latitude, location.longitude);
  const sun = calc.getBodyPositionJ2000(Body.Sun, now);
  const altitude = calc.getAltAz(sun.ra, sun.dec, now).altitude;
  const nearby = weather
    ? [...weather.hourlyData]
        .filter(([t]) => Math.abs(t - now.getTime()) < 3_600_000)
        .sort((a, b) => Math.abs(a[0] - now.getTime()) - Math.abs(b[0] - now.getTime()))[0]?.[1]
    : null;
  return (
    <section className="rounded-xl border border-white/10 bg-night-900 p-4" aria-label="Aurora now">
      <button
        type="button"
        className="min-h-11 font-semibold text-sm text-teal-200"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Aurora now · {open ? 'hide' : 'check local context'}
      </button>
      {open && (
        <div className="space-y-2 text-sm">
          <p className="text-gray-400 text-xs">
            Current conditions, independent of the selected forecast night. A clear{' '}
            {location.latitude >= 0 ? 'northern' : 'southern'} horizon is needed.
          </p>
          {data ? (
            <>
              <p className="text-teal-200">
                {local
                  ? `OVATION grid: ${local.local}/100 locally · up to ${local.poleward}/100 within 1,000 km poleward`
                  : 'OVATION unavailable or expired; local aurora potential is unknown.'}
              </p>
              {data.ovation && (
                <p className="text-gray-500 text-xs">
                  Forecast valid{' '}
                  {new Date(data.ovation.forecastAt).toLocaleString(undefined, {
                    timeZone: location.timezone,
                  })}{' '}
                  · input observed{' '}
                  {new Date(data.ovation.observedAt).toLocaleString(undefined, {
                    timeZone: location.timezone,
                  })}
                </p>
              )}
              <p className="text-gray-300">
                Sun {altitude.toFixed(0)}° ·{' '}
                {altitude > -6
                  ? 'too bright for a useful visual assessment'
                  : 'dark enough to check the sky'}{' '}
                · cloud{' '}
                {nearby ? `${nearby.cloudCover}% forecast` : 'unavailable for the current hour'}.
              </p>
              <p className="text-gray-300">
                Solar wind {readingLabel(data.speed, 'km/s', now)} · Bz{' '}
                {readingLabel(data.bz, 'nT', now)}.
              </p>
              <p className="text-gray-400 text-xs">
                Grid values describe the auroral model, not your chance of seeing an aurora.
                Southward Bz can support activity; cloud, darkness and horizon still matter. Only
                active-spacecraft readings less than an hour old are used.
              </p>
            </>
          ) : (
            <p className="text-gray-400">Checking NOAA…</p>
          )}
          <a
            className="inline-block min-h-11 text-teal-200 underline"
            href="https://www.spaceweather.gov/products/aurora-30-minute-forecast"
            target="_blank"
            rel="noreferrer"
          >
            NOAA aurora map ↗
          </a>
        </div>
      )}
    </section>
  );
}

function readingLabel(reading: SolarWindReading | null, unit: string, now: Date) {
  if (!reading || now.getTime() - new Date(reading.observedAt).getTime() > 3_600_000)
    return 'unavailable';
  return `${reading.value.toFixed(1)} ${unit} (${reading.source}, ${reading.observedAt.slice(11, 16)} UTC)`;
}
