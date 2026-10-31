import { numeric, publicData, record } from '@/lib/api/public-data';
import type { NightInfo } from '@/types';

export interface EnsembleForecast {
  fetchedAt: string;
  times: number[];
  members: {
    id: string;
    clouds: (number | null)[];
    rain: (number | null)[];
    gusts: (number | null)[];
  }[];
}
export function parseEnsemble(raw: unknown): EnsembleForecast {
  const hourly = record(record(raw).hourly);
  if (
    !Array.isArray(hourly.time) ||
    !hourly.time.every(t => typeof t === 'number' && Number.isFinite(t))
  )
    throw new Error('Missing ensemble timestamps');
  const times = hourly.time.map(t => Number(t) * 1000);
  const members = Object.keys(hourly)
    .filter(k => /^cloud_cover(?:_member\d+)?$/.test(k))
    .flatMap(key => {
      const suffix = key.slice('cloud_cover'.length);
      const cloudValues = hourly[key];
      const rainValues = hourly[`precipitation${suffix}`];
      const gustValues = hourly[`wind_gusts_10m${suffix}`];
      if (!Array.isArray(cloudValues)) return [];
      const values = (rawValues: unknown, maximum = Number.POSITIVE_INFINITY) =>
        times.map((_, index) => {
          const value = numeric(Array.isArray(rawValues) ? rawValues[index] : null);
          return value !== null && value >= 0 && value <= maximum ? value : null;
        });
      // ICON's global members can provide cloud/rain without gusts. Preserve
      // those members; a missing variable must never become a calm-wind value.
      const clouds = values(cloudValues, 100);
      const rain = values(rainValues);
      const gusts = values(gustValues);
      return [{ id: suffix || 'control', clouds, rain, gusts }];
    });
  if (members.length < 2) throw new Error('Insufficient ensemble members');
  return { fetchedAt: new Date().toISOString(), times, members };
}
export function fetchEnsemble(latitude: number, longitude: number) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    hourly: 'cloud_cover,precipitation,wind_gusts_10m',
    models: 'icon_seamless',
    forecast_days: '8',
    timeformat: 'unixtime',
  });
  return publicData(
    `ensemble:${latitude.toFixed(3)}:${longitude.toFixed(3)}`,
    3_600_000,
    `https://ensemble-api.open-meteo.com/v1/ensemble?${params}`,
    parseEnsemble
  );
}
/** Evaluate the same rolling two-hour interval across members, never unrelated clear hours. */
export function ensembleWindow(data: EnsembleForecast, night: NightInfo) {
  let best: {
    start: number;
    end: number;
    support: number;
    members: number;
    gustMembers: number;
    gustsAssessed: boolean;
    cloudLow: number;
    cloudHigh: number;
  } | null = null;
  for (let i = 0; i < data.times.length - 2; i++) {
    const start = data.times[i];
    const end = data.times[i + 2];
    if (
      start < night.observingWindowStart.getTime() ||
      end > night.observingWindowEnd.getTime() ||
      data.times[i + 1] - start !== 3_600_000 ||
      end - data.times[i + 1] !== 3_600_000
    )
      continue;
    const valid = data.members.filter(m =>
      [i, i + 1, i + 2].every(j => m.clouds[j] != null && m.rain[j] != null)
    );
    if (valid.length < Math.max(2, data.members.length * 0.8)) continue;
    const gustMembers = valid.filter(m => [i, i + 1, i + 2].every(j => m.gusts[j] != null)).length;
    const gustsAssessed = gustMembers === valid.length;
    const support = valid.filter(m =>
      [i, i + 1, i + 2].every(
        j =>
          (m.clouds[j] as number) < 30 &&
          (m.rain[j] as number) < 0.1 &&
          (!gustsAssessed || (m.gusts[j] as number) < 40)
      )
    ).length;
    const clouds = valid
      .map(
        m =>
          ((m.clouds[i] as number) + (m.clouds[i + 1] as number) + (m.clouds[i + 2] as number)) / 3
      )
      .sort((a, b) => a - b);
    const candidate = {
      start,
      end,
      support,
      members: valid.length,
      gustMembers,
      gustsAssessed,
      cloudLow: clouds[Math.floor((clouds.length - 1) * 0.1)],
      cloudHigh: clouds[Math.floor((clouds.length - 1) * 0.9)],
    };
    if (!best || support / valid.length > best.support / best.members) best = candidate;
  }
  return best;
}
