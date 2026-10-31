import { numeric, publicData, record } from '@/lib/api/public-data';
import { utcTime } from './swpc';
export interface Ovation {
  observedAt: string;
  forecastAt: string;
  fetchedAt: string;
  coordinates: number[][];
}
export function parseOvation(raw: unknown): Ovation {
  const r = record(raw);
  const observedAt = utcTime(r['Observation Time']);
  const forecastAt = utcTime(r['Forecast Time']);
  if (!observedAt || !forecastAt || !Array.isArray(r.coordinates))
    throw new Error('Invalid OVATION forecast');
  const coordinates = r.coordinates.filter(
    (c): c is number[] =>
      Array.isArray(c) &&
      c.length === 3 &&
      c.every(v => numeric(v) !== null) &&
      c[1] >= -90 &&
      c[1] <= 90 &&
      c[2] >= 0 &&
      c[2] <= 100
  );
  if (coordinates.length < 100) throw new Error('Incomplete OVATION grid');
  return { observedAt, forecastAt, fetchedAt: new Date().toISOString(), coordinates };
}
export function fetchOvation() {
  return publicData(
    'ovation',
    10 * 60_000,
    'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json',
    parseOvation
  );
}
function distance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}
export function localOvation(data: Ovation, latitude: number, longitude: number, now = Date.now()) {
  if (
    Math.abs(new Date(data.forecastAt).getTime() - now) > 90 * 60_000 ||
    now - new Date(data.observedAt).getTime() > 4 * 3_600_000
  )
    return null;
  let nearest = Infinity;
  let local = 0;
  let poleward = 0;
  for (const [lon, lat, value] of data.coordinates) {
    const km = distance(latitude, longitude, lat, lon);
    if (km < nearest) {
      nearest = km;
      local = value;
    }
    if (km <= 1000 && (latitude >= 0 ? lat >= latitude : lat <= latitude))
      poleward = Math.max(poleward, value);
  }
  return { local, poleward };
}
export interface SolarWindReading {
  observedAt: string;
  source: string;
  value: number;
}
export function parseSolarWind(
  raw: unknown,
  field: 'bz_gsm' | 'proton_speed',
  now = Date.now()
): SolarWindReading | null {
  if (!Array.isArray(raw)) throw new Error('Invalid solar-wind feed');
  return (
    raw
      .flatMap(value => {
        const r = record(value);
        const v = numeric(r[field]);
        const observedAt = utcTime(r.time_tag);
        const age = now - new Date(observedAt).getTime();
        if (
          r.active !== true ||
          r.overall_quality !== 0 ||
          v === null ||
          age < 0 ||
          age > 3_600_000 ||
          Math.abs(v) > 5000 ||
          (field === 'proton_speed' && v <= 0)
        )
          return [];
        return [{ observedAt, source: String(r.source), value: v }];
      })
      .sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0] ?? null
  );
}
export async function fetchSolarWind() {
  const [bz, speed] = await Promise.all(
    (['bz_gsm', 'proton_speed'] as const).map(field =>
      publicData(
        `solar-wind:${field}`,
        5 * 60_000,
        `https://services.swpc.noaa.gov/json/rtsw/${field === 'bz_gsm' ? 'rtsw_mag_1m' : 'rtsw_wind_1m'}.json`,
        raw => ({ reading: parseSolarWind(raw, field) })
      )
    )
  );
  return { bz: bz?.reading ?? null, speed: speed?.reading ?? null };
}
