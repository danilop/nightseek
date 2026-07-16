import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultHorizonProfile } from '@/lib/utils/horizon-profile';
import {
  createMockNightForecast,
  createMockNightInfo,
  createMockNightWeather,
  createMockObjectVisibility,
  createMockScoredObject,
} from '@/test/factories';
import type { HorizonProfile, Location } from '@/types';
import GalacticCorePlannerCard from './GalacticCorePlannerCard';

const location: Location = {
  latitude: 40.7128,
  longitude: -74.006,
  timezone: 'America/New_York',
};

function createCoreFixture() {
  const start = new Date('2026-07-17T02:00:00Z');
  const altitudeSamples: [Date, number][] = Array.from({ length: 7 }, (_, index) => [
    new Date(start.getTime() + index * 10 * 60_000),
    35 + Math.min(index, 6 - index) * 2,
  ]);
  const azimuthSamples: [Date, number][] = altitudeSamples.map(([time], index) => [
    time,
    160 + index * 5,
  ]);
  const visibility = createMockObjectVisibility({
    objectName: 'Milky Way Core',
    objectType: 'milky_way',
    commonName: 'Milky Way Core (Sagittarius A*)',
    magnitude: null,
    surfaceBrightness: null,
    raHours: 17.761122,
    decDegrees: -29.007811,
    constellation: 'Sagittarius',
    maxAltitude: 41,
    maxAltitudeTime: altitudeSamples[3][0],
    azimuthAtPeak: 175,
    altitudeSamples,
    azimuthSamples,
  });
  const nightInfo = createMockNightInfo({
    date: new Date('2026-07-16T12:00:00Z'),
    observingWindowStart: start,
    observingWindowEnd: altitudeSamples[6][0],
    sunset: new Date('2026-07-17T00:30:00Z'),
    sunrise: new Date('2026-07-17T09:30:00Z'),
    moonIllumination: 5,
  });
  const weather = createMockNightWeather({
    avgCloudCover: 5,
    transparencyScore: 90,
  });
  const forecast = createMockNightForecast({ nightInfo, weather, milkyWay: visibility });
  const core = createMockScoredObject({
    objectName: visibility.objectName,
    category: 'milky_way',
    subtype: null,
    visibility,
    magnitude: null,
  });
  return { forecast, core };
}

function renderPlanner(horizonProfile: HorizonProfile) {
  const { forecast, core } = createCoreFixture();
  render(
    <GalacticCorePlannerCard
      core={core}
      forecast={forecast}
      forecastRange={[forecast]}
      horizonProfile={horizonProfile}
      location={location}
      onOpenDetails={vi.fn()}
      onShowSky={vi.fn()}
    />
  );
}

describe('GalacticCorePlannerCard', () => {
  it('shows an exact photo window, sky path, and the magnitude explanation', () => {
    renderPlanner(createDefaultHorizonProfile());

    expect(screen.getByText('Photo-ready')).toBeInTheDocument();
    expect(screen.getByText('Best photo window')).toBeInTheDocument();
    expect(screen.getByText('Where it moves during the photo window')).toBeInTheDocument();
    expect(screen.getByText(/No single magnitude usefully describes/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show on sky map' })).toBeEnabled();
  });

  it('explains when a southern obstruction blocks the core', () => {
    const profile = createDefaultHorizonProfile();
    const blockedSouth = {
      ...profile,
      sectors: profile.sectors.map(sector =>
        sector.label === 'S' ? { ...sector, minAltitude: 90 } : sector
      ),
    } satisfies HorizonProfile;

    renderPlanner(blockedSouth);

    expect(screen.getByText('Blocked by your sky profile')).toBeInTheDocument();
    expect(screen.queryByText('Best photo window')).not.toBeInTheDocument();
  });
});
