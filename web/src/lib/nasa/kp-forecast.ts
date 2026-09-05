import { getCached, setCache } from '../utils/cache';

export interface KpForecastPeriod {
  start: Date;
  end: Date;
  kp: number;
  kind: 'observed' | 'estimated' | 'predicted';
}
const URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json';
const KEY = 'nightseek:swpc:kp-forecast:v1';

/** NOAA changed this product from table rows to objects in 2026. Accept both
 * formats while rejecting malformed or out-of-range values. All times are UTC. */
export function parseKpForecast(raw: unknown): KpForecastPeriod[] {
  if (!Array.isArray(raw)) return [];
  const records: unknown[] = Array.isArray(raw[0])
    ? raw
        .slice(1)
        .filter(Array.isArray)
        .map(row => Object.fromEntries((raw[0] as string[]).map((key, index) => [key, row[index]])))
    : raw;
  const periods: KpForecastPeriod[] = [];
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    const row = record as Record<string, unknown>;
    const time = row.time_tag;
    const kind = row.observed;
    if (typeof time !== 'string' || !['observed', 'estimated', 'predicted'].includes(String(kind)))
      continue;
    const start = new Date(/[zZ]$|[+-]\d\d:\d\d$/.test(time) ? time : `${time.replace(' ', 'T')}Z`);
    const kp = row.kp === null || row.kp === '' ? NaN : Number(row.kp);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(kp) || kp < 0 || kp > 9) continue;
    periods.push({
      start,
      end: new Date(start.getTime() + 3 * 3_600_000),
      kp,
      kind: kind as KpForecastPeriod['kind'],
    });
  }
  return periods.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function kpOutlookForWindow(periods: KpForecastPeriod[], start: Date, end: Date) {
  const matching = periods.filter(
    period => period.kind !== 'observed' && period.start < end && period.end > start
  );
  if (matching.length === 0) return null;
  return { maxKp: Math.max(...matching.map(period => period.kp)), periods: matching };
}

export async function fetchKpForecast(): Promise<KpForecastPeriod[]> {
  const cached = await getCached<KpForecastPeriod[]>(KEY, 60 * 60 * 1000);
  if (cached) return cached;
  try {
    const response = await fetch(URL, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) return [];
    const data = parseKpForecast(await response.json());
    if (data.length) await setCache(KEY, data);
    return data;
  } catch {
    return [];
  }
}
