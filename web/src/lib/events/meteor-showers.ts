import * as Astronomy from 'astronomy-engine';
import type { MeteorShower, NightInfo } from '@/types';
import { angularSeparation, type SkyCalculator } from '../astronomy/calculator';
import { getRadiantConstellation, IAU_METEOR_SHOWERS } from './iau-meteor-data';

/**
 * Major meteor showers data (legacy - now using IAU_METEOR_SHOWERS for more complete data)
 * Kept for backwards compatibility
 */
const METEOR_SHOWERS: Omit<
  MeteorShower,
  | 'isActive'
  | 'daysFromPeak'
  | 'radiantAltitude'
  | 'moonIllumination'
  | 'moonSeparationDeg'
  | 'moonAltitudeDeg'
>[] = [
  {
    name: 'Quadrantids',
    code: 'QUA',
    peakMonth: 1,
    peakDay: 3,
    startMonth: 12,
    startDay: 28,
    endMonth: 1,
    endDay: 12,
    zhr: 120,
    radiantRaDeg: 230.1,
    radiantDecDeg: 48.5,
    velocityKms: 41,
    parentObject: '2003 EH1',
  },
  {
    name: 'Lyrids',
    code: 'LYR',
    peakMonth: 4,
    peakDay: 22,
    startMonth: 4,
    startDay: 14,
    endMonth: 4,
    endDay: 30,
    zhr: 18,
    radiantRaDeg: 271.4,
    radiantDecDeg: 33.6,
    velocityKms: 49,
    parentObject: 'C/1861 G1 (Thatcher)',
  },
  {
    name: 'Eta Aquariids',
    code: 'ETA',
    peakMonth: 5,
    peakDay: 6,
    startMonth: 4,
    startDay: 19,
    endMonth: 5,
    endDay: 28,
    zhr: 50,
    radiantRaDeg: 338.0,
    radiantDecDeg: -1.0,
    velocityKms: 66,
    parentObject: '1P/Halley',
  },
  {
    name: 'Southern Delta Aquariids',
    code: 'SDA',
    peakMonth: 7,
    peakDay: 30,
    startMonth: 7,
    startDay: 12,
    endMonth: 8,
    endDay: 23,
    zhr: 25,
    radiantRaDeg: 340.0,
    radiantDecDeg: -16.0,
    velocityKms: 41,
    parentObject: '96P/Machholz',
  },
  {
    name: 'Alpha Capricornids',
    code: 'CAP',
    peakMonth: 7,
    peakDay: 30,
    startMonth: 7,
    startDay: 3,
    endMonth: 8,
    endDay: 15,
    zhr: 5,
    radiantRaDeg: 307.0,
    radiantDecDeg: -10.0,
    velocityKms: 23,
    parentObject: '169P/NEAT',
  },
  {
    name: 'Perseids',
    code: 'PER',
    peakMonth: 8,
    peakDay: 12,
    startMonth: 7,
    startDay: 17,
    endMonth: 8,
    endDay: 24,
    zhr: 100,
    radiantRaDeg: 48.0,
    radiantDecDeg: 58.0,
    velocityKms: 59,
    parentObject: '109P/Swift-Tuttle',
  },
  {
    name: 'Orionids',
    code: 'ORI',
    peakMonth: 10,
    peakDay: 21,
    startMonth: 10,
    startDay: 2,
    endMonth: 11,
    endDay: 7,
    zhr: 20,
    radiantRaDeg: 95.0,
    radiantDecDeg: 16.0,
    velocityKms: 66,
    parentObject: '1P/Halley',
  },
  {
    name: 'Southern Taurids',
    code: 'STA',
    peakMonth: 11,
    peakDay: 5,
    startMonth: 9,
    startDay: 10,
    endMonth: 11,
    endDay: 20,
    zhr: 5,
    radiantRaDeg: 52.0,
    radiantDecDeg: 13.0,
    velocityKms: 27,
    parentObject: '2P/Encke',
  },
  {
    name: 'Northern Taurids',
    code: 'NTA',
    peakMonth: 11,
    peakDay: 12,
    startMonth: 10,
    startDay: 20,
    endMonth: 12,
    endDay: 10,
    zhr: 5,
    radiantRaDeg: 58.0,
    radiantDecDeg: 22.0,
    velocityKms: 29,
    parentObject: '2P/Encke',
  },
  {
    name: 'Leonids',
    code: 'LEO',
    peakMonth: 11,
    peakDay: 17,
    startMonth: 11,
    startDay: 6,
    endMonth: 11,
    endDay: 30,
    zhr: 15,
    radiantRaDeg: 152.0,
    radiantDecDeg: 22.0,
    velocityKms: 71,
    parentObject: '55P/Tempel-Tuttle',
  },
  {
    name: 'Geminids',
    code: 'GEM',
    peakMonth: 12,
    peakDay: 14,
    startMonth: 12,
    startDay: 4,
    endMonth: 12,
    endDay: 20,
    zhr: 150,
    radiantRaDeg: 112.0,
    radiantDecDeg: 33.0,
    velocityKms: 35,
    parentObject: '3200 Phaethon',
  },
  {
    name: 'Ursids',
    code: 'URS',
    peakMonth: 12,
    peakDay: 22,
    startMonth: 12,
    startDay: 17,
    endMonth: 12,
    endDay: 26,
    zhr: 10,
    radiantRaDeg: 217.0,
    radiantDecDeg: 76.0,
    velocityKms: 33,
    parentObject: '8P/Tuttle',
  },
];

/**
 * Check if a shower is active on a given date
 */
function calendarDay(month: number, day: number): number {
  return (Date.UTC(2001, month - 1, day) - Date.UTC(2001, 0, 1)) / 86_400_000;
}

function getActivityOffsets(shower: (typeof METEOR_SHOWERS)[0]): {
  start: number;
  end: number;
} {
  const peak = calendarDay(shower.peakMonth, shower.peakDay);
  let start = calendarDay(shower.startMonth, shower.startDay);
  let end = calendarDay(shower.endMonth, shower.endDay);
  if (start > peak) start -= 365;
  if (end < peak) end += 365;
  return { start: start - peak, end: end - peak };
}

function getShowerTiming(
  shower: (typeof IAU_METEOR_SHOWERS)[number],
  date: Date
): { isActive: boolean; daysFromPeak: number; peakTime: Date } {
  const candidatePeaks: Date[] = [];
  const year = date.getUTCFullYear();
  for (let candidateYear = year - 1; candidateYear <= year + 1; candidateYear++) {
    const peak = Astronomy.SearchSunLongitude(
      shower.solarLongitudePeak,
      new Date(Date.UTC(candidateYear, 0, 1)),
      370
    );
    if (peak) candidatePeaks.push(peak.date);
  }
  const fallbackPeak = new Date(Date.UTC(year, shower.peakMonth - 1, shower.peakDay, 12));
  const peakTime = candidatePeaks.reduce(
    (closest, candidate) =>
      Math.abs(candidate.getTime() - date.getTime()) < Math.abs(closest.getTime() - date.getTime())
        ? candidate
        : closest,
    fallbackPeak
  );
  const daysFromPeak = (date.getTime() - peakTime.getTime()) / 86_400_000;
  const offsets = getActivityOffsets(shower);
  return {
    isActive: daysFromPeak >= offsets.start && daysFromPeak <= offsets.end,
    daysFromPeak,
    peakTime,
  };
}

/**
 * Detect active meteor showers for a given night
 * Uses the expanded IAU Meteor Data Center catalog
 */
export function detectMeteorShowers(
  calculator: SkyCalculator,
  nightInfo: NightInfo
): MeteorShower[] {
  const results: MeteorShower[] = [];
  if (nightInfo.observingWindowMode === 'none') return results;

  // Calculate at midnight
  const midnight = new Date(
    (nightInfo.observingWindowStart.getTime() + nightInfo.observingWindowEnd.getTime()) / 2
  );

  // Use IAU catalog for comprehensive meteor shower data
  for (const shower of IAU_METEOR_SHOWERS) {
    const { isActive, daysFromPeak } = getShowerTiming(shower, midnight);

    if (!isActive) continue;

    // Calculate radiant altitude at midnight
    const radiantRaDeg = shower.radiantRaDeg + (shower.radiantRaDrift ?? 0) * daysFromPeak;
    const radiantDecDeg = shower.radiantDecDeg + (shower.radiantDecDrift ?? 0) * daysFromPeak;
    const { altitude } = calculator.getAltAz(radiantRaDeg / 15, radiantDecDeg, midnight);

    // Calculate moon separation from radiant
    const moonPos = calculator.getMoonPosition(midnight);
    const moonSeparation = angularSeparation(
      radiantRaDeg,
      radiantDecDeg,
      moonPos.ra * 15,
      moonPos.dec
    );

    results.push({
      ...shower,
      radiantRaDeg,
      radiantDecDeg,
      isActive: true,
      daysFromPeak,
      radiantAltitude: altitude,
      moonIllumination: nightInfo.moonIllumination,
      moonSeparationDeg: moonSeparation,
      moonAltitudeDeg: moonPos.altitude,
    });
  }

  // Sort by ZHR (highest first)
  return results.sort((a, b) => b.zhr - a.zhr);
}

/**
 * Get detailed IAU meteor shower info including constellation
 */
export function getIAUMeteorShowerInfo(shower: MeteorShower): {
  constellation: string;
  solarLongitude: number | null;
} {
  // Find the IAU data for this shower
  const iauData = IAU_METEOR_SHOWERS.find(s => s.code === shower.code);

  if (!iauData) {
    return {
      constellation: getRadiantConstellation(shower.radiantRaDeg, shower.radiantDecDeg),
      solarLongitude: null,
    };
  }

  return {
    constellation: getRadiantConstellation(shower.radiantRaDeg, shower.radiantDecDeg),
    solarLongitude: iauData.solarLongitudePeak,
  };
}

/**
 * Get the at-peak geometric ceiling for this radiant altitude.
 * This is not a personal meteor-rate forecast: limiting magnitude,
 * population index, local obstructions, and the shower's activity profile
 * require data the app does not have.
 */
export function getGeometricHourlyRateCeiling(shower: MeteorShower): number {
  if (!shower.isActive || shower.radiantAltitude === null) return 0;

  // ZHR is the rate when radiant is at zenith
  // Actual rate = ZHR * sin(radiant altitude)
  const radiantFactor = Math.max(0, Math.sin((shower.radiantAltitude * Math.PI) / 180));

  return Math.round(shower.zhr * radiantFactor);
}
