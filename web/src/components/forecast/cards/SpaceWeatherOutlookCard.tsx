import { ExternalLink, Orbit } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchKpForecast, type KpForecastPeriod, kpOutlookForWindow } from '@/lib/nasa/kp-forecast';
import { formatTimeRange } from '@/lib/utils/format';
import type { NightInfo } from '@/types';

export default function SpaceWeatherOutlookCard({
  nightInfo,
  timezone,
}: {
  nightInfo: NightInfo;
  timezone?: string;
}) {
  const [periods, setPeriods] = useState<KpForecastPeriod[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetchKpForecast().then(value => {
      if (!cancelled) setPeriods(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const outlook = periods
    ? kpOutlookForWindow(periods, nightInfo.observingWindowStart, nightInfo.observingWindowEnd)
    : null;
  return (
    <section
      className="rounded-xl border border-white/10 bg-night-900 p-4"
      aria-labelledby="space-outlook-title"
    >
      <h3
        id="space-outlook-title"
        className="flex items-center gap-2 font-semibold text-sm text-white"
      >
        <Orbit className="h-4 w-4 text-teal-300" /> Space weather outlook
      </h3>
      {outlook ? (
        <>
          <p className="mt-3 font-semibold text-teal-200 text-xl">
            Kp {outlook.maxKp.toFixed(1)}{' '}
            <span className="font-normal text-gray-400 text-xs">maximum in covered hours</span>
          </p>
          <p className="mt-2 text-gray-400 text-xs">
            NOAA estimates and predictions overlapping this night. Kp describes global geomagnetic
            activity; it does not guarantee local aurora visibility.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {outlook.periods.map(period => (
              <span
                key={period.start.toISOString()}
                className="rounded-lg bg-white/5 px-2 py-1 text-gray-300 text-xs"
              >
                {formatTimeRange(period.start, period.end, timezone)} · {period.kp.toFixed(1)} (
                {period.kind})
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-3 text-gray-400 text-sm">
          {periods
            ? 'No current NOAA outlook covers this night. Forecasts usually extend about three days.'
            : 'Checking the NOAA outlook…'}
        </p>
      )}
      <a
        href="https://www.swpc.noaa.gov/products/aurora-viewline-tonight-and-tomorrow-night-experimental"
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex min-h-11 items-center gap-1 text-teal-200 text-xs"
      >
        NOAA aurora viewline <ExternalLink className="h-3 w-3" />
      </a>
    </section>
  );
}
