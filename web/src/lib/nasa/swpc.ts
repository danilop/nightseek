/** Public NOAA observations. Observation time, not download order, determines freshness. */
import { CACHE_KEYS, CACHE_TTLS, getCached, setCache } from '../utils/cache';

export interface KpIndexReading {
  timeTag: string;
  kpIndex: number;
  estimatedKp: number;
  kpSource: string;
}
export interface SolarFlareProbability {
  dateRange: string;
  cClassProbability: number;
  mClassProbability: number;
  xClassProbability: number;
}
export interface SunspotRegion {
  region: number;
  spotCount: number;
  spotClass: string;
  magClass: string;
  location: string;
  area: number;
  observedAt?: string;
}
export interface SolarFluxReading {
  timeTag: string;
  flux: number;
}
export interface SWPCData {
  kpIndex: KpIndexReading[];
  flareProbabilities: SolarFlareProbability[];
  sunspotRegions: SunspotRegion[];
  solarFlux: SolarFluxReading | null;
  fetchedAt: string;
}
type Row = Record<string, unknown>;
const BASE = 'https://services.swpc.noaa.gov/json';
const HOUR = 3_600_000;

export function utcTime(value: unknown): string {
  if (typeof value !== 'string') return '';
  const input = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value.replace(' ', 'T')}Z`;
  const time = new Date(input);
  return Number.isFinite(time.getTime()) ? time.toISOString() : '';
}
function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function recent(time: string, hours: number, now = Date.now()): boolean {
  const age = now - new Date(time).getTime();
  return Number.isFinite(age) && age >= -5 * 60_000 && age <= hours * HOUR;
}
export function parseKpIndex(raw: Row[]): KpIndexReading[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .flatMap(row => {
      const kp = number(row.kp_index ?? row.kp);
      const time = utcTime(row.time_tag);
      return kp !== null && kp >= 0 && kp <= 9 && time
        ? [
            {
              timeTag: time,
              kpIndex: kp,
              estimatedKp: number(row.estimated_kp) ?? kp,
              kpSource: String(row.source ?? 'SWPC'),
            },
          ]
        : [];
    })
    .sort((a, b) => a.timeTag.localeCompare(b.timeTag));
}
export function parseFlareProbabilities(raw: Row[]): SolarFlareProbability[] {
  if (!Array.isArray(raw)) return [];
  const rows = [...raw].sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
  if (rows[0]?.date && 'c_class_1_day' in rows[0]) {
    const row = rows[0];
    const base = new Date(utcTime(row.date)).getTime();
    if (!Number.isFinite(base)) return [];
    return [1, 2, 3].flatMap(day => {
      const c = number(row[`c_class_${day}_day`]);
      const m = number(row[`m_class_${day}_day`]);
      const x = number(row[`x_class_${day}_day`]);
      return c !== null && m !== null && x !== null && [c, m, x].every(v => v >= 0 && v <= 100)
        ? [
            {
              dateRange: new Date(base + (day - 1) * 24 * HOUR).toISOString().slice(0, 10),
              cClassProbability: c,
              mClassProbability: m,
              xClassProbability: x,
            },
          ]
        : [];
    });
  }
  return rows.flatMap(row => {
    const c = number(row.C ?? row.c_class);
    const m = number(row.M ?? row.m_class);
    const x = number(row.X ?? row.x_class);
    const date = String(row.DateRange ?? row['date-range'] ?? '');
    return date && c !== null && m !== null && x !== null
      ? [{ dateRange: date, cClassProbability: c, mClassProbability: m, xClassProbability: x }]
      : [];
  });
}
export function parseSunspotReport(raw: Row[]): SunspotRegion[] {
  if (!Array.isArray(raw)) return [];
  const rows = [...raw].sort((a, b) =>
    utcTime(b.time_tag ?? b.Obsdate).localeCompare(utcTime(a.time_tag ?? a.Obsdate))
  );
  const latestDay = utcTime(rows[0]?.Obsdate ?? rows[0]?.time_tag).slice(0, 10);
  const regions = new Map<number, SunspotRegion>();
  for (const row of rows) {
    const id = number(row.Region ?? row.region);
    const observedAt = utcTime(row.time_tag ?? row.Obsdate);
    if (
      id === null ||
      regions.has(id) ||
      (latestDay && utcTime(row.Obsdate ?? row.time_tag).slice(0, 10) !== latestDay)
    )
      continue;
    regions.set(id, {
      region: id,
      spotCount: number(row.Numspot ?? row.numspot) ?? 0,
      spotClass: String(row.Spotclass ?? row.Zurich ?? row.zurich ?? ''),
      magClass: String(row.Magclass ?? row.Magtype ?? row.magtype ?? ''),
      location: String(row.Location ?? row.location ?? ''),
      area: number(row.Area ?? row.area) ?? 0,
      ...(observedAt ? { observedAt } : {}),
    });
  }
  return [...regions.values()];
}
export function parseSolarFlux(raw: Row[]): SolarFluxReading | null {
  if (!Array.isArray(raw)) return null;
  return (
    raw
      .flatMap(row => {
        const flux = number(row.flux);
        const timeTag = utcTime(row.time_tag);
        return flux !== null && flux > 0 && timeTag ? [{ flux, timeTag }] : [];
      })
      .sort((a, b) => b.timeTag.localeCompare(a.timeTag))[0] ?? null
  );
}
async function fetchRows(file: string): Promise<Row[]> {
  try {
    const response = await fetch(`${BASE}/${file}`, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return [];
    const rows: unknown = await response.json();
    return Array.isArray(rows)
      ? rows.filter((r): r is Row => r !== null && typeof r === 'object')
      : [];
  } catch {
    return [];
  }
}
export async function fetchSWPCData(): Promise<SWPCData | null> {
  const cached = await getCached<SWPCData>(CACHE_KEYS.SWPC_COMBINED, CACHE_TTLS.SWPC_KP);
  if (cached) return cached;
  const [kp, flare, spots, flux] = await Promise.all(
    [
      'planetary_k_index_1m.json',
      'solar_probabilities.json',
      'sunspot_report.json',
      'f107_cm_flux.json',
    ].map(fetchRows)
  );
  const solarFlux = parseSolarFlux(flux);
  const data: SWPCData = {
    kpIndex: parseKpIndex(kp).filter(r => recent(r.timeTag, 24)),
    flareProbabilities: parseFlareProbabilities(flare),
    sunspotRegions: parseSunspotReport(spots).filter(r => r.observedAt && recent(r.observedAt, 48)),
    solarFlux: solarFlux && recent(solarFlux.timeTag, 48) ? solarFlux : null,
    fetchedAt: new Date().toISOString(),
  };
  if (
    !data.kpIndex.length &&
    !data.flareProbabilities.length &&
    !data.sunspotRegions.length &&
    !data.solarFlux
  )
    return null;
  await setCache(CACHE_KEYS.SWPC_COMBINED, data);
  return data;
}
export function getCurrentKp(data: SWPCData, now = Date.now()): number | null {
  const latest = [...data.kpIndex].sort((a, b) => b.timeTag.localeCompare(a.timeTag))[0];
  return latest && recent(latest.timeTag, 1, now) ? latest.estimatedKp : null;
}
/** Maximum within the available recent series, not a claim of 24-hour coverage. */
export function getRecentMaxKp(data: SWPCData, now = Date.now()): number | null {
  const readings = data.kpIndex.filter(r => recent(r.timeTag, 24, now));
  return readings.length ? Math.max(...readings.map(r => r.estimatedKp)) : null;
}
export function getSolarActivityLabel(
  flux: number | null
): 'unknown' | 'low' | 'moderate' | 'high' | 'very high' {
  if (flux === null) return 'unknown';
  return flux < 100 ? 'low' : flux < 150 ? 'moderate' : flux < 200 ? 'high' : 'very high';
}
export function getTodayFlareProbability(
  data: SWPCData,
  now = new Date()
): SolarFlareProbability | null {
  return data.flareProbabilities.find(r => r.dateRange === now.toISOString().slice(0, 10)) ?? null;
}
