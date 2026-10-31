import { numeric, publicData, record } from '@/lib/api/public-data';
export interface ModelHour {
  time: number;
  cloud: number | null;
  fog: number | null;
  rain: number | null;
}
export interface ModelForecast {
  updatedAt: string;
  fetchedAt: string;
  hours: ModelHour[];
}
export function parseMetNorway(raw: unknown): ModelForecast {
  const properties = record(record(raw).properties);
  const meta = record(properties.meta);
  if (!Array.isArray(properties.timeseries) || typeof meta.updated_at !== 'string')
    throw new Error('Missing MET forecast');
  const hours = properties.timeseries
    .map(item => {
      const row = record(item);
      const data = record(row.data);
      const details = record(record(data.instant).details);
      return {
        time: new Date(String(row.time)).getTime(),
        cloud: numeric(details.cloud_area_fraction),
        fog: numeric(details.fog_area_fraction),
        rain: data.next_1_hours
          ? numeric(record(record(data.next_1_hours).details).precipitation_amount)
          : null,
      };
    })
    .filter(h => Number.isFinite(h.time));
  return { updatedAt: meta.updated_at, fetchedAt: new Date().toISOString(), hours };
}
export function fetchMetNorway(latitude: number, longitude: number) {
  // Browser Referer identifies this public app; no forbidden custom User-Agent header.
  const lat = latitude.toFixed(3);
  const lon = longitude.toFixed(3);
  return publicData(
    `metno:${lat}:${lon}`,
    3_600_000,
    `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${lat}&lon=${lon}`,
    parseMetNorway
  );
}
