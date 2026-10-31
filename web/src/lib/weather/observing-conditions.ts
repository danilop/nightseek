import type { HourlyWeather, NightInfo, NightWeather } from '@/types';

/** Shared equipment/sky limits. These are planning thresholds, not a safety guarantee. */
export function observingBlockers(hour: HourlyWeather): string[] {
  const reasons: string[] = [];
  if (hour.cloudCover >= 70) reasons.push('heavy cloud');
  if ((hour.precipitation ?? 0) >= 0.1) reasons.push('rain or snow');
  if ((hour.precipProbability ?? 0) >= 70) reasons.push('high precipitation risk');
  if ((hour.windGust ?? 0) >= 40 || (hour.windSpeed ?? 0) >= 30) reasons.push('strong wind');
  if (hour.visibility !== null && hour.visibility < 1000) reasons.push('very poor visibility');
  if ((hour.fogCover ?? 0) >= 50) reasons.push('fog');
  return reasons;
}

export function weatherCoverage(weather: NightWeather, night: NightInfo) {
  const expected = Math.max(
    1,
    Math.floor(night.observingWindowEnd.getTime() / 3_600_000) -
      Math.ceil(night.observingWindowStart.getTime() / 3_600_000) +
      1
  );
  const hours = [...weather.hourlyData.values()];
  return {
    expected,
    weather: hours.length,
    aerosol: hours.filter(h => h.aod != null && Number.isFinite(h.aod)).length,
    precipitation: hours.filter(h => h.precipitation != null && Number.isFinite(h.precipitation))
      .length,
    wind: hours.filter(h => h.windGust != null && Number.isFinite(h.windGust)).length,
    visibility: hours.filter(h => h.visibility != null && Number.isFinite(h.visibility)).length,
  };
}

export function forecastConfidence(
  weather: NightWeather | null,
  night: NightInfo
): 'high' | 'medium' | 'low' {
  if (!weather) return 'low';
  const c = weatherCoverage(weather, night);
  if (c.weather < c.expected * 0.8) return 'low';
  const leadDays = (night.date.getTime() - Date.now()) / 86_400_000;
  return Math.min(c.aerosol, c.precipitation, c.wind, c.visibility) >= c.expected && leadDays <= 2
    ? 'high'
    : 'medium';
}
