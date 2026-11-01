import { describe, expect, it } from 'vitest';
import {
  createMockNightForecast,
  createMockNightInfo,
  createMockNightWeather,
  createMockObjectVisibility,
  createMockScoredObject,
} from '@/test/factories';
import { createDefaultHorizonProfile } from '../utils/horizon-profile';
import { calculateHeadlineNightQuality } from '../weather/night-quality';
import { planNightNotification } from './night-notification';

const night = createMockNightInfo({ moonIllumination: 0 });
const start = night.observingWindowStart;
const end = night.observingWindowEnd;
const now = new Date(night.sunset.getTime() - 2 * 3_600_000);
const profile = createDefaultHorizonProfile();
function fixture(cloudCover = 0) {
  const weather = createMockNightWeather({
    avgCloudCover: cloudCover,
    avgWindSpeedKmh: 5,
    transparencyScore: 95,
    dewRiskHours: 0,
    bestTime: { start, end, score: 90, reason: 'Clear' },
  });
  for (
    let time = Math.ceil(start.getTime() / 3_600_000) * 3_600_000;
    time <= end.getTime();
    time += 3_600_000
  ) {
    weather.hourlyData.set(time, {
      cloudCover,
      visibility: 10000,
      windSpeed: 5,
      windGust: 8,
      humidity: 50,
      temperature: 5,
      dewPoint: 0,
      precipProbability: 0,
      precipitation: 0,
      pressure: 1013,
      cape: 0,
      aod: 0.05,
      pm25: 5,
      pm10: 10,
      dust: 0,
    });
  }
  const target = createMockScoredObject({
    totalScore: 180,
    visibility: createMockObjectVisibility({
      altitudeSamples: [
        [start, 60],
        [end, 60],
      ],
      azimuthSamples: [
        [start, 180],
        [end, 180],
      ],
      imagingWindow: {
        start,
        end,
        quality: 'good',
        qualityScore: 80,
        factors: { altitude: 60, airmass: 1.2, moonInterference: 0, cloudCover },
      },
    }),
  });
  return { forecast: createMockNightForecast({ nightInfo: night, weather }), target };
}

describe('native night notifications', () => {
  it('uses the same night label and eligible targets as the app', () => {
    const { forecast, target } = fixture();
    const plan = planNightNotification(forecast, [target], profile, now);
    const rating = calculateHeadlineNightQuality(forecast.weather, night).rating;
    expect(rating.stars).toBeGreaterThanOrEqual(4);
    expect(plan?.title).toBe(`${rating.label} Observing Window Tonight`);
    expect(plan?.body).toContain(target.objectName);
    expect(plan?.at.getTime()).toBe(night.sunset.getTime() - 3_600_000);
  });
  it('does not announce a good night solely because a target scores well', () => {
    const { forecast, target } = fixture(100);
    expect(planNightNotification(forecast, [target], profile, now)).toBeNull();
    expect(
      planNightNotification({ ...forecast, weather: null }, [target], profile, now)
    ).toBeNull();
  });
  it('does not recommend blocked targets or schedule elapsed alerts', () => {
    const { forecast, target } = fixture();
    const blocked = { ...profile, sectors: profile.sectors.map(s => ({ ...s, minAltitude: 90 })) };
    expect(planNightNotification(forecast, [target], blocked, now)).toBeNull();
    expect(planNightNotification(forecast, [target], profile, night.sunset)).toBeNull();
  });
});
