import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TargetAltitudeChart from '@/components/forecast/TargetAltitudeChart';
import {
  createDefaultHorizonProfile,
  evaluateTargetAccessibility,
} from '@/lib/utils/horizon-profile';
import { createMockNightInfo, createMockObjectVisibility } from '@/test/factories';
import type { HorizonProfile, ObjectVisibility } from '@/types';

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

/**
 * A target arcing from 5° up to ~65° and back, sweeping SE → SW, sampled on the
 * analyser's real 10-minute grid.
 */
function createVisibility(overrides: Partial<ObjectVisibility> = {}): ObjectVisibility {
  const altitudeSamples: [Date, number][] = [];
  const azimuthSamples: [Date, number][] = [];
  const totalMinutes = (WINDOW_END.getTime() - WINDOW_START.getTime()) / 60_000;

  let maxAltitude = -90;
  let maxAltitudeTime: Date | null = null;
  let azimuthAtPeak = 0;

  for (let minutes = 0; minutes <= totalMinutes; minutes += 10) {
    const time = new Date(WINDOW_START.getTime() + minutes * 60_000);
    const altitude = 5 + 60 * Math.sin((Math.PI * minutes) / totalMinutes);
    const azimuth = 120 + (minutes / totalMinutes) * 120;
    altitudeSamples.push([time, altitude]);
    azimuthSamples.push([time, azimuth]);
    if (altitude > maxAltitude) {
      maxAltitude = altitude;
      maxAltitudeTime = time;
      azimuthAtPeak = azimuth;
    }
  }

  return createMockObjectVisibility({
    objectName: 'M42',
    commonName: 'Orion Nebula',
    altitudeSamples,
    azimuthSamples,
    maxAltitude,
    maxAltitudeTime,
    azimuthAtPeak,
    ...overrides,
  });
}

function createProfile(overrides: Partial<HorizonProfile> = {}): HorizonProfile {
  return { ...createDefaultHorizonProfile(), ...overrides };
}

function renderChart(
  visibility = createVisibility(),
  horizonProfile = createProfile(),
  nightInfo = createNightInfo()
) {
  return render(
    <TargetAltitudeChart
      visibility={visibility}
      nightInfo={nightInfo}
      horizonProfile={horizonProfile}
      accessibility={evaluateTargetAccessibility(visibility, horizonProfile, null)}
      calculator={null}
      timezone="UTC"
    />
  );
}

describe('TargetAltitudeChart', () => {
  it('describes the peak and the accessible window in its accessible name', () => {
    renderChart();

    const chart = screen.getByRole('img');
    expect(chart).toHaveAccessibleName(/Altitude of Orion Nebula/);
    expect(chart).toHaveAccessibleName(/Peaks at 6[45]°/);
    expect(chart).toHaveAccessibleName(/Above your horizon limits/);
  });

  it('paints the seven twilight bands in order', () => {
    const { container } = renderChart();
    const bands = [...container.querySelectorAll('[data-twilight-phase]')];

    expect(bands.map(band => band.getAttribute('data-twilight-phase'))).toEqual([
      'civil',
      'nautical',
      'astronomical',
      'night',
      'astronomical',
      'nautical',
      'civil',
    ]);
  });

  it('draws the altitude curve and the accessible-window shading', () => {
    const { container } = renderChart();

    expect(container.querySelectorAll('[data-testid="altitude-curve"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-testid="accessible-window"]').length).toBeGreaterThan(
      0
    );
  });

  it('draws the whole-sky minimum as a dotted line only when one is set', () => {
    const { container: withMinimum } = renderChart(
      createVisibility(),
      createProfile({ minimumAltitude: 30 })
    );
    const line = withMinimum.querySelector('[data-testid="whole-sky-minimum"]');

    expect(line).not.toBeNull();
    expect(line?.getAttribute('stroke-dasharray')).toBe('2 3');
    // 30° of 90° sits one third up the 164-unit plot from its 176 baseline.
    expect(Number(line?.getAttribute('y1'))).toBeCloseTo(176 - (30 / 90) * 164, 5);

    const { container: withoutMinimum } = renderChart();
    expect(withoutMinimum.querySelector('[data-testid="whole-sky-minimum"]')).toBeNull();
  });

  it('draws the directional obstructions as a step line with cardinal labels', () => {
    const profile = createProfile();
    profile.sectors = profile.sectors.map(sector =>
      sector.label === 'S' ? { ...sector, minAltitude: 30 } : sector
    );

    const { container } = renderChart(createVisibility(), profile);
    const path = container.querySelector('[data-testid="sector-threshold"]');

    expect(path).not.toBeNull();
    const commands = path?.getAttribute('d') ?? '';
    expect(commands).toMatch(/H/);
    expect(commands).toMatch(/V/);
    expect(screen.getByText('S')).toBeInTheDocument();
  });

  it('marks a blocked direction and says so in the readout', () => {
    const profile = createProfile();
    profile.sectors = profile.sectors.map(sector =>
      sector.label === 'S' ? { ...sector, minAltitude: 90 } : sector
    );

    const { container } = renderChart(createVisibility(), profile);
    expect(container.querySelectorAll('[data-testid="blocked-sector"]').length).toBeGreaterThan(0);

    // Mid-night the target is due south, inside the blocked sector.
    fireEvent.change(screen.getByRole('slider', { name: /scrub the altitude chart/i }), {
      target: { value: '500' },
    });
    expect(screen.getByText(/blocked by the S obstruction/)).toBeInTheDocument();
  });

  it('updates the live readout and aria-valuetext while scrubbing', () => {
    renderChart();
    const slider = screen.getByRole('slider', { name: /scrub the altitude chart/i });

    fireEvent.change(slider, { target: { value: '500' } });

    const readout = screen.getByText(/Astronomical Night/);
    expect(readout).toBeInTheDocument();
    expect(slider).toHaveAttribute('aria-valuetext', readout.textContent ?? '');
  });

  it('explains itself instead of drawing when the night has no usable window', () => {
    const visibility = createVisibility({ altitudeSamples: [], azimuthSamples: [] });
    render(
      <TargetAltitudeChart
        visibility={visibility}
        nightInfo={createNightInfo({ observingWindowMode: 'none' })}
        horizonProfile={createProfile()}
        accessibility={evaluateTargetAccessibility(visibility, createProfile(), null)}
        calculator={null}
        timezone="UTC"
      />
    );

    expect(screen.getByText(/No usable dark window tonight/)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('reports a target that never rises without drawing a filled area', () => {
    const totalMinutes = (WINDOW_END.getTime() - WINDOW_START.getTime()) / 60_000;
    const altitudeSamples: [Date, number][] = [];
    const azimuthSamples: [Date, number][] = [];
    for (let minutes = 0; minutes <= totalMinutes; minutes += 10) {
      const time = new Date(WINDOW_START.getTime() + minutes * 60_000);
      altitudeSamples.push([time, -20]);
      azimuthSamples.push([time, 180]);
    }

    const { container } = renderChart(
      createVisibility({
        altitudeSamples,
        azimuthSamples,
        maxAltitude: -20,
        maxAltitudeTime: WINDOW_START,
      })
    );

    expect(screen.getByRole('img')).toHaveAccessibleName(/stays below the horizon all night/i);
    expect(screen.getByText('Stays below the horizon all night.')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-testid="altitude-curve"]')).toHaveLength(0);
    expect(container.querySelector('[data-testid="peak-marker"]')).toBeNull();
  });

  it('shows a single night band under continuous darkness', () => {
    const { container } = renderChart(
      createVisibility(),
      createProfile(),
      createNightInfo({ astronomicalNightMode: 'continuous', observingWindowMode: 'continuous' })
    );
    const bands = [...container.querySelectorAll('[data-twilight-phase]')];

    expect(bands).toHaveLength(1);
    expect(bands[0].getAttribute('data-twilight-phase')).toBe('night');
  });
});
