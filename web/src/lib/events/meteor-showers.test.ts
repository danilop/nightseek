import { describe, expect, it } from 'vitest';
import { SkyCalculator } from '@/lib/astronomy/calculator';
import { IAU_METEOR_SHOWERS } from './iau-meteor-data';
import { detectMeteorShowers, getGeometricHourlyRateCeiling } from './meteor-showers';

describe('meteor shower timing', () => {
  it('uses annual solar longitude and applies radiant drift', () => {
    const calculator = new SkyCalculator(51.5074, -0.1278);
    const night = calculator.getNightInfo(new Date('2026-08-12T11:00:00Z'));
    const perseids = detectMeteorShowers(calculator, night).find(shower => shower.code === 'PER');
    const catalog = IAU_METEOR_SHOWERS.find(shower => shower.code === 'PER');

    expect(perseids).toBeDefined();
    expect(catalog).toBeDefined();
    expect(Math.abs(perseids?.daysFromPeak ?? 2)).toBeLessThan(1);
    expect(perseids?.radiantRaDeg).toBeCloseTo(
      (catalog?.radiantRaDeg ?? 0) + (catalog?.radiantRaDrift ?? 0) * (perseids?.daysFromPeak ?? 0),
      10
    );
  });

  it('returns no visual shower forecast without astronomical darkness', () => {
    const calculator = new SkyCalculator(69.6492, 18.9553);
    const night = calculator.getNightInfo(new Date('2026-06-21T12:00:00Z'));
    expect(detectMeteorShowers(calculator, night)).toEqual([]);
  });

  it('labels only a geometric ceiling from ZHR and radiant altitude', () => {
    expect(
      getGeometricHourlyRateCeiling({
        ...IAU_METEOR_SHOWERS[0],
        isActive: true,
        daysFromPeak: 0,
        radiantAltitude: 30,
        moonIllumination: 100,
        moonSeparationDeg: 1,
      })
    ).toBe(Math.round(IAU_METEOR_SHOWERS[0].zhr * 0.5));
  });
});
