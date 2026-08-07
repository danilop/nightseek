import { describe, expect, it, vi } from 'vitest';
import { type AltAzSource, buildNightAltitudeTrack } from '@/lib/astronomy/night-altitude-track';
import { createMockNightInfo, createMockObjectVisibility } from '@/test/factories';

const SUNSET = new Date('2025-01-15T17:00:00Z');
const SUNRISE = new Date('2025-01-16T07:00:00Z');
const WINDOW_START = new Date('2025-01-15T19:00:00Z');
const WINDOW_END = new Date('2025-01-16T05:00:00Z');

function createNightInfo(overrides = {}) {
  return createMockNightInfo({
    sunset: SUNSET,
    sunrise: SUNRISE,
    astronomicalDusk: WINDOW_START,
    astronomicalDawn: WINDOW_END,
    observingWindowStart: WINDOW_START,
    observingWindowEnd: WINDOW_END,
    ...overrides,
  });
}

/** Analysed samples on the analyser's real 10-minute grid. */
function createVisibility() {
  const altitudeSamples: [Date, number][] = [];
  const azimuthSamples: [Date, number][] = [];
  for (let timeMs = WINDOW_START.getTime(); timeMs <= WINDOW_END.getTime(); timeMs += 600_000) {
    const minutesIn = (timeMs - WINDOW_START.getTime()) / 60_000;
    altitudeSamples.push([new Date(timeMs), 10 + minutesIn / 20]);
    azimuthSamples.push([new Date(timeMs), 90 + minutesIn / 10]);
  }
  return createMockObjectVisibility({
    raHours: 5,
    decDegrees: 20,
    altitudeSamples,
    azimuthSamples,
  });
}

function createCalculator(): AltAzSource {
  return { getAltAz: vi.fn(() => ({ altitude: -5, azimuth: 300 })) };
}

describe('buildNightAltitudeTrack', () => {
  it('spans sunset to sunrise when a calculator is available', () => {
    const track = buildNightAltitudeTrack(
      createVisibility(),
      createNightInfo(),
      createCalculator()
    );

    expect(track.startMs).toBe(SUNSET.getTime());
    expect(track.endMs).toBe(SUNRISE.getTime());
    expect(track.extended).toBe(true);
  });

  it('returns strictly ascending, deduplicated timestamps', () => {
    const track = buildNightAltitudeTrack(
      createVisibility(),
      createNightInfo(),
      createCalculator()
    );

    for (let index = 1; index < track.points.length; index++) {
      expect(track.points[index].timeMs).toBeGreaterThan(track.points[index - 1].timeMs);
    }
    expect(new Set(track.points.map(point => point.timeMs)).size).toBe(track.points.length);
  });

  it('preserves every analysed sample verbatim', () => {
    const visibility = createVisibility();
    const track = buildNightAltitudeTrack(visibility, createNightInfo(), createCalculator());
    const byTime = new Map(track.points.map(point => [point.timeMs, point]));

    for (const [time, altitude] of visibility.altitudeSamples) {
      const point = byTime.get(time.getTime());
      expect(point).toBeDefined();
      expect(point?.altitude).toBeCloseTo(altitude, 10);
    }
  });

  it('only calls the calculator outside the analysed window', () => {
    const visibility = createVisibility();
    const calculator = createCalculator();
    buildNightAltitudeTrack(visibility, createNightInfo(), calculator);

    const calledTimes = vi
      .mocked(calculator.getAltAz)
      .mock.calls.map(([, , time]) => (time as Date).getTime());

    expect(calledTimes.length).toBeGreaterThan(0);
    for (const timeMs of calledTimes) {
      expect(timeMs < WINDOW_START.getTime() || timeMs > WINDOW_END.getTime()).toBe(true);
    }
  });

  it('limits the track to the analysed samples when no calculator is supplied', () => {
    const track = buildNightAltitudeTrack(createVisibility(), createNightInfo(), null);

    expect(track.extended).toBe(false);
    expect(track.startMs).toBe(WINDOW_START.getTime());
    expect(track.endMs).toBe(WINDOW_END.getTime());
    expect(track.points[0].timeMs).toBe(WINDOW_START.getTime());
    expect(track.points[track.points.length - 1].timeMs).toBe(WINDOW_END.getTime());
  });

  it('returns no points for an unanalysed night without a calculator', () => {
    const visibility = createMockObjectVisibility({ altitudeSamples: [], azimuthSamples: [] });
    const track = buildNightAltitudeTrack(
      visibility,
      createNightInfo({ observingWindowMode: 'none' }),
      null
    );

    expect(track.points).toEqual([]);
  });

  it('still builds a curve from the ephemeris when nothing was analysed', () => {
    const visibility = createMockObjectVisibility({ altitudeSamples: [], azimuthSamples: [] });
    const calculator = createCalculator();
    const track = buildNightAltitudeTrack(visibility, createNightInfo(), calculator);

    expect(track.points.length).toBeGreaterThan(10);
    expect(track.extended).toBe(true);
  });

  it('covers a continuous-darkness window that extends beyond sunset and sunrise', () => {
    const windowStart = new Date('2025-01-15T12:00:00Z');
    const windowEnd = new Date('2025-01-16T12:00:00Z');
    const track = buildNightAltitudeTrack(
      createVisibility(),
      createNightInfo({
        astronomicalNightMode: 'continuous',
        observingWindowMode: 'continuous',
        observingWindowStart: windowStart,
        observingWindowEnd: windowEnd,
      }),
      createCalculator()
    );

    expect(track.startMs).toBe(windowStart.getTime());
    expect(track.endMs).toBe(windowEnd.getTime());
  });

  it('honours a custom sample step', () => {
    const coarse = buildNightAltitudeTrack(
      createVisibility(),
      createNightInfo(),
      createCalculator(),
      { stepMinutes: 60 }
    );
    const fine = buildNightAltitudeTrack(
      createVisibility(),
      createNightInfo(),
      createCalculator(),
      { stepMinutes: 5 }
    );

    expect(fine.points.length).toBeGreaterThan(coarse.points.length);
  });
});
