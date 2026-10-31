import * as Astronomy from 'astronomy-engine';
import { fromZonedTime } from 'date-fns-tz';
import {
  degreesToRadians,
  ecfToLookAngles,
  eciToEcf,
  gstime,
  json2satrec,
  propagate,
  radiansToDegrees,
} from 'satellite.js';
import { describe, expect, it } from 'vitest';
import { SkyCalculator } from '@/lib/astronomy/calculator';
import { nightDateAtOffset } from '@/lib/forecast/night-dates';
import { calculateSatellitePasses } from '@/lib/satellites/passes';
import { parseOMM } from '@/lib/satellites/tle';
import { createDefaultHorizonProfile } from '@/lib/utils/horizon-profile';
import type { Location, SatellitePass } from '@/types';
import fixture from './fixtures/london-2026-10-31.json';

const cities = [
  { name: 'London', latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London' },
  { name: 'New York', latitude: 40.7128, longitude: -74.006, timezone: 'America/New_York' },
  { name: 'Sydney', latitude: -33.8688, longitude: 151.2093, timezone: 'Australia/Sydney' },
  { name: 'Tromsø', latitude: 69.6492, longitude: 18.9553, timezone: 'Europe/Oslo' },
  { name: 'Quito', latitude: -0.1807, longitude: -78.4678, timezone: 'America/Guayaquil' },
  { name: 'Auckland', latitude: -36.8485, longitude: 174.7633, timezone: 'Pacific/Auckland' },
  { name: 'Honolulu', latitude: 21.3069, longitude: -157.8583, timezone: 'Pacific/Honolulu' },
];
const elements = parseOMM(fixture.omm)[0];
if (!elements.omm) throw new Error('Missing captured ISS OMM fixture');
const satellite = json2satrec(elements.omm);

function observation(location: Location, time: Date) {
  const state = propagate(satellite, time);
  if (!state?.position || typeof state.position === 'boolean')
    throw new Error('ISS propagation failed');
  const position = state.position;
  const look = ecfToLookAngles(
    {
      latitude: degreesToRadians(location.latitude),
      longitude: degreesToRadians(location.longitude),
      height: 0,
    },
    eciToEcf(position, gstime(time))
  );
  const observer = new Astronomy.Observer(location.latitude, location.longitude, 0);
  const equator = Astronomy.Equator(Astronomy.Body.Sun, time, observer, true, true);
  const sunAltitude = Astronomy.Horizon(time, observer, equator.ra, equator.dec).altitude;
  // An independent ephemeris and angular-disc occultation check, not the production
  // sunPos/conical-shadow implementation. EQD/TEME equinox differences are tiny;
  // allow 0.02 degrees around the shadow edge when comparing their solar vectors.
  const sun = Astronomy.RotateVector(
    Astronomy.Rotation_EQJ_EQD(time),
    Astronomy.GeoVector(Astronomy.Body.Sun, time, true)
  );
  const toSun = [
    sun.x * Astronomy.KM_PER_AU - position.x,
    sun.y * Astronomy.KM_PER_AU - position.y,
    sun.z * Astronomy.KM_PER_AU - position.z,
  ];
  const radius = Math.hypot(position.x, position.y, position.z);
  const sunDistance = Math.hypot(...toSun);
  const separation = Math.acos(
    Math.max(
      -1,
      Math.min(
        1,
        (-position.x * toSun[0] - position.y * toSun[1] - position.z * toSun[2]) /
          (radius * sunDistance)
      )
    )
  );
  const shadowMargin = radiansToDegrees(
    separation - Math.asin(6378.137 / radius) + Math.asin(695700 / sunDistance)
  );
  return {
    altitude: radiansToDegrees(look.elevation),
    azimuth: radiansToDegrees(look.azimuth),
    sunAltitude,
    shadowMargin,
  };
}
function interiorTimes(pass: SatellitePass) {
  const start = pass.riseTime.getTime() + 2000;
  const end = pass.setTime.getTime() - 2000;
  const times = [pass.maxTime, new Date((pass.riseTime.getTime() + pass.setTime.getTime()) / 2)];
  for (let time = start; time <= end; time += 30_000) times.push(new Date(time));
  return times;
}

describe.each(cities)('$name: global ISS pass physics using captured OMM', location => {
  const calculator = new SkyCalculator(location.latitude, location.longitude);
  const anchor = fromZonedTime('2026-10-31T12:00:00', location.timezone);
  // Include nearby dates to exercise real visible southern passes; the Oct 31
  // forecast week has none for Sydney/Auckland with these captured elements.
  const nights = Array.from({ length: 21 }, (_, i) =>
    calculator.getNightInfo(nightDateAtOffset(anchor, location.timezone, i - 7))
  );
  const passes = calculateSatellitePasses(elements, location, nights);

  it('keeps every pass dark, sunlit, above 10 degrees and inside its local night', () => {
    if (location.name === 'Tromsø') expect(passes).toHaveLength(0);
    else expect(passes.length).toBeGreaterThan(0);
    for (const pass of passes) {
      expect(nights.some(n => pass.riseTime >= n.sunset && pass.setTime <= n.sunrise)).toBe(true);
      expect(pass.riseTime.getTime()).toBeLessThanOrEqual(pass.maxTime.getTime());
      expect(pass.maxTime.getTime()).toBeLessThanOrEqual(pass.setTime.getTime());
      expect(pass.duration).toBe(
        Math.round((pass.setTime.getTime() - pass.riseTime.getTime()) / 1000)
      );
      expect(pass.elementEpoch).toBe(elements.epoch);
      const peak = observation(location, pass.maxTime);
      expect(pass.maxAltitude).toBeCloseTo(peak.altitude, 7);
      for (const time of interiorTimes(pass)) {
        const actual = observation(location, time);
        expect(actual.altitude).toBeGreaterThanOrEqual(9.99);
        expect(actual.sunAltitude).toBeLessThanOrEqual(-5.98);
        expect(actual.shadowMargin).toBeGreaterThanOrEqual(-0.02);
      }
    }
  });

  it('respects a raised site horizon and fully blocked directions', () => {
    const profile = createDefaultHorizonProfile();
    profile.minimumAltitude = 30;
    profile.sectors = profile.sectors.map(sector => ({
      ...sector,
      minAltitude: sector.label === 'E' ? 90 : 0,
    }));
    const obstructed = calculateSatellitePasses(elements, location, nights, profile);
    for (const pass of obstructed) {
      for (const time of interiorTimes(pass)) {
        const actual = observation(location, time);
        expect(actual.altitude).toBeGreaterThanOrEqual(29.99);
        // East sector occupies azimuths [67.5, 112.5); sample strictly inside each pass.
        expect(actual.azimuth < 67.5 || actual.azimuth >= 112.5).toBe(true);
      }
    }
    profile.sectors = profile.sectors.map(sector => ({ ...sector, minAltitude: 90 }));
    expect(calculateSatellitePasses(elements, location, nights, profile)).toEqual([]);
  });

  it('suppresses stale orbital predictions beyond the 14-day validity guard', () => {
    const staleNight = calculator.getNightInfo(nightDateAtOffset(anchor, location.timezone, 20));
    expect(calculateSatellitePasses(elements, location, [staleNight])).toEqual([]);
  });
});
