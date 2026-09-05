import { describe, expect, it } from 'vitest';
import { createMockNightInfo } from '@/test/factories';
import { parseNightWeather } from './open-meteo';

describe('parseNightWeather practical best window selection', () => {
  it('keeps a multi-hour early window when conditions are practical for imaging', () => {
    const nightInfo = createMockNightInfo({
      astronomicalDusk: new Date('2025-01-15T20:00:00Z'),
      astronomicalDawn: new Date('2025-01-16T04:00:00Z'),
    });

    const weather = parseNightWeather(
      {
        timezone: 'UTC',
        hourly: {
          time: [
            '2025-01-15T20:00',
            '2025-01-15T21:00',
            '2025-01-15T22:00',
            '2025-01-15T23:00',
            '2025-01-16T00:00',
          ],
          cloud_cover: [75, 18, 12, 14, 55],
          relative_humidity_2m: [78, 62, 60, 61, 74],
          wind_speed_10m: [18, 6, 5, 6, 14],
          wind_gusts_10m: [30, 10, 9, 10, 24],
          temperature_2m: [4, 3, 3, 2, 1],
          dew_point_2m: [2, -1, -1, -2, -1],
        },
      },
      null,
      nightInfo
    );

    expect(weather?.bestTime?.start.toISOString()).toBe('2025-01-15T21:00:00.000Z');
    expect(weather?.bestTime?.end.toISOString()).toBe('2025-01-15T23:00:00.000Z');
  });

  it('drops a late one-hour marginal slot instead of treating it as a usable best window', () => {
    const nightInfo = createMockNightInfo({
      astronomicalDusk: new Date('2025-01-15T21:00:00Z'),
      astronomicalDawn: new Date('2025-01-16T03:08:00Z'),
    });

    const weather = parseNightWeather(
      {
        timezone: 'UTC',
        hourly: {
          time: [
            '2025-01-15T21:00',
            '2025-01-15T22:00',
            '2025-01-15T23:00',
            '2025-01-16T00:00',
            '2025-01-16T01:00',
            '2025-01-16T02:00',
            '2025-01-16T03:00',
          ],
          cloud_cover: [100, 98, 94, 89, 79, 66, 59],
          relative_humidity_2m: [60, 63, 67, 70, 74, 78, 79],
          wind_speed_10m: [14, 14.4, 15.8, 16.6, 15.8, 14.8, 14],
          wind_gusts_10m: [28.4, 29.2, 31.3, 32.8, 31.3, 29.2, 28.1],
          temperature_2m: [12.1, 12, 12, 11.8, 11.4, 11, 10.6],
          dew_point_2m: [4.6, 5.2, 6, 6.5, 6.9, 7.3, 7.1],
        },
      },
      null,
      nightInfo
    );

    expect(weather?.bestTime).toBeNull();
  });
});

describe('missing weather and forecast boundaries', () => {
  const night = createMockNightInfo({
    astronomicalDusk: new Date('2025-01-15T20:00:00Z'),
    astronomicalDawn: new Date('2025-01-16T06:00:00Z'),
  });
  it('does not convert null clouds into a clear forecast', () => {
    expect(
      parseNightWeather(
        { timezone: 'UTC', hourly: { time: ['2025-01-15T20:00'], cloud_cover: [null] } },
        null,
        night
      )
    ).toBeNull();
  });
  it('never extends truncated clear data to dawn', () => {
    const result = parseNightWeather(
      {
        timezone: 'UTC',
        hourly: { time: ['2025-01-15T20:00', '2025-01-15T21:00'], cloud_cover: [0, 0] },
      },
      null,
      night
    );
    expect(result?.clearWindows[0].end.toISOString()).toBe('2025-01-15T21:00:00.000Z');
    expect(result?.clearDurationHours).toBe(1);
  });
  it('does not bridge a missing hour in clear or best windows', () => {
    const result = parseNightWeather(
      {
        timezone: 'UTC',
        hourly: {
          time: [
            '2025-01-15T20:00',
            '2025-01-15T21:00',
            '2025-01-15T22:00',
            '2025-01-15T23:00',
            '2025-01-16T00:00',
          ],
          cloud_cover: [0, 0, null, 0, 0],
        },
      },
      null,
      night
    );
    expect(result?.clearWindows).toHaveLength(2);
    expect(result?.bestTime).toBeNull();
  });
  it('joins air quality by instant across source timezones and retains hourly values', () => {
    const result = parseNightWeather(
      { timezone: 'UTC', hourly: { time: ['2025-01-15T20:00'], cloud_cover: [10] } },
      {
        timezone: 'America/New_York',
        hourly: { time: ['2025-01-15T15:00'], aerosol_optical_depth: [0.1] },
      },
      night
    );
    expect(result?.hourlyData.get(Date.parse('2025-01-15T20:00Z'))?.aod).toBe(0.1);
    expect(result?.transparencyScore).toBe(80);
  });
});
