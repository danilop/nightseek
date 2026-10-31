import rawMeta from '@/data/meta.json';

const meta = rawMeta as { sources: Record<string, string | null>; errors?: string[] };

const names: Record<string, string> = {
  'neo.json': 'NASA close approaches',
  'comets.json': 'MPC comet elements',
  'donki.json': 'NASA DONKI events',
  'ephemeris.json': 'JPL reference ephemerides',
};
export default function SourceHealthCard() {
  return (
    <details className="rounded-xl border border-white/10 bg-night-900 p-4 lg:col-span-2">
      <summary className="min-h-11 cursor-pointer text-gray-300 text-sm">
        Data sources & freshness
      </summary>
      <ul className="mt-2 space-y-2 text-gray-400 text-xs">
        {Object.entries(meta.sources).map(([name, time]) => {
          const age = (Date.now() - new Date(time ?? '').getTime()) / 86_400_000;
          const stale = !Number.isFinite(age) || age > 2;
          return (
            <li key={name}>
              {names[name]} · snapshot {time ? new Date(time).toLocaleString() : 'unknown'} ·{' '}
              {Number.isFinite(age)
                ? stale
                  ? `${Math.floor(age)} days old — treat as stale`
                  : 'updated within two days'
                : 'age unknown'}
            </li>
          );
        })}
      </ul>
      {(meta.errors?.length ?? 0) > 0 && (
        <p className="mt-3 text-amber-300 text-xs">
          A source failed during the latest update. Its previous snapshot is retained; stale event
          data is not treated as an all-clear.
        </p>
      )}
      <p className="mt-3 text-gray-400 text-xs">
        Weather and satellite forecasts show their own timestamps. NED galaxy references are
        refreshed weekly. Solar activity and aurora are model estimates or reported observations,
        not a guarantee of local visibility.
      </p>
      <p className="mt-2 text-gray-400 text-xs">
        Meteor and variable-star predictions use curated IAU MDC / AAVSO VSX tables. Their original
        edition is not recorded; dates, rates and periods are approximate. Check the current{' '}
        <a
          href="https://www.imo.net/calendar/"
          className="underline"
          target="_blank"
          rel="noreferrer"
        >
          IMO calendar
        </a>{' '}
        and{' '}
        <a href="https://www.aavso.org/vsx/" className="underline" target="_blank" rel="noreferrer">
          VSX
        </a>{' '}
        before planning a time-critical observation.
      </p>
    </details>
  );
}
