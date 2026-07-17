import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultHorizonProfile } from '@/lib/utils/horizon-profile';
import {
  createMockMilkyWayPlan,
  createMockNightForecast,
  createMockNightInfo,
  createMockNightWeather,
  createMockObjectVisibility,
  createMockScoredObject,
} from '@/test/factories';
import type { HorizonProfile, Location } from '@/types';
import MilkyWayPlannerCard from './MilkyWayPlannerCard';

const location: Location = {
  latitude: 40.7128,
  longitude: -74.006,
  timezone: 'America/New_York',
};

function createPlannerFixture() {
  const start = new Date('2026-07-17T02:00:00Z');
  const altitudeSamples: [Date, number][] = Array.from({ length: 7 }, (_, index) => [
    new Date(start.getTime() + index * 10 * 60_000),
    35 + Math.min(index, 6 - index) * 2,
  ]);
  const azimuthSamples: [Date, number][] = altitudeSamples.map(([time], index) => [
    time,
    5 + index * 5,
  ]);
  const bandVisibility = createMockObjectVisibility({
    objectName: 'Milky Way',
    objectType: 'milky_way',
    commonName: 'Cygnus band',
    magnitude: null,
    surfaceBrightness: null,
    raHours: 20.5,
    decDegrees: 40,
    constellation: 'Cygnus band',
    maxAltitude: 41,
    maxAltitudeTime: altitudeSamples[3][0],
    azimuthAtPeak: 20,
    altitudeSamples,
    azimuthSamples,
  });
  const coreVisibility = createMockObjectVisibility({
    objectName: 'Galactic Core',
    objectType: 'milky_way',
    commonName: 'Galactic Core (Sagittarius A*)',
    isVisible: false,
    magnitude: null,
    surfaceBrightness: null,
    raHours: 17.761122,
    decDegrees: -29.007811,
    maxAltitude: -12,
    maxAltitudeTime: altitudeSamples[3][0],
    azimuthAtPeak: 180,
    altitudeSamples: altitudeSamples.map(([time, altitude]) => [time, altitude - 55]),
    azimuthSamples: altitudeSamples.map(([time]) => [time, 180]),
  });
  const nightInfo = createMockNightInfo({
    date: new Date('2026-07-16T12:00:00Z'),
    observingWindowStart: start,
    observingWindowEnd: altitudeSamples[6][0],
    sunset: new Date('2026-07-17T00:30:00Z'),
    sunrise: new Date('2026-07-17T09:30:00Z'),
    moonIllumination: 5,
  });
  const weather = createMockNightWeather({ avgCloudCover: 5, transparencyScore: 90 });
  const milkyWay = createMockMilkyWayPlan({
    coreVisibility,
    sections: [
      {
        id: 'cygnus',
        label: 'Cygnus band',
        description: 'A bright northern star field split by the Great Rift.',
        galacticLongitudeDeg: 80,
        relativeProminence: 0.88,
        samples: [{ galacticLatitudeDeg: 0, visibility: bandVisibility }],
      },
    ],
  });
  const forecast = createMockNightForecast({ nightInfo, weather, milkyWay });
  const target = createMockScoredObject({
    objectName: 'Milky Way',
    category: 'milky_way',
    subtype: null,
    visibility: bandVisibility,
    magnitude: null,
  });
  return { forecast, target };
}

function renderPlanner(horizonProfile: HorizonProfile, onShowSky = vi.fn()) {
  const { forecast, target } = createPlannerFixture();
  render(
    <MilkyWayPlannerCard
      target={target}
      forecast={forecast}
      forecastRange={[forecast]}
      horizonProfile={horizonProfile}
      location={location}
      onOpenDetails={vi.fn()}
      onShowSky={onShowSky}
    />
  );
}

describe('MilkyWayPlannerCard', () => {
  it('recommends an extended band even when the Galactic Core is unavailable', () => {
    renderPlanner(createDefaultHorizonProfile());

    expect(screen.getByRole('heading', { name: 'Milky Way Planner' })).toBeInTheDocument();
    expect(screen.getByText('Photo-ready')).toBeInTheDocument();
    expect(screen.getByText('Cygnus band')).toBeInTheDocument();
    expect(screen.getByText('Best photo window')).toBeInTheDocument();
    expect(screen.getByText('Galactic Core')).toBeInTheDocument();
    expect(screen.getByText('Not available tonight')).toBeInTheDocument();
    expect(screen.queryByText('Galactic Core planner')).not.toBeInTheDocument();
  });

  it('applies directional obstructions to the selected Milky Way section', () => {
    const profile = createDefaultHorizonProfile();
    const blockedNorth = {
      ...profile,
      sectors: profile.sectors.map(sector =>
        sector.label === 'N' || sector.label === 'NE' ? { ...sector, minAltitude: 90 } : sector
      ),
    } satisfies HorizonProfile;

    renderPlanner(blockedNorth);

    expect(screen.getByText('Blocked by your sky profile')).toBeInTheDocument();
    expect(screen.queryByText('Best photo window')).not.toBeInTheDocument();
  });

  it('hands the sky chart the selected band section and peak time', () => {
    const onShowSky = vi.fn();
    renderPlanner(createDefaultHorizonProfile(), onShowSky);

    fireEvent.click(screen.getByRole('button', { name: 'Show Milky Way on sky map' }));

    expect(onShowSky).toHaveBeenCalledWith({
      time: new Date('2026-07-17T02:30:00Z'),
      raHours: 20.5,
      decDegrees: 40,
      label: 'Cygnus band',
    });
  });

  it('does not call a twilight-only candidate photo-ready', () => {
    const { forecast, target } = createPlannerFixture();
    const twilightForecast = createMockNightForecast({
      ...forecast,
      nightInfo: createMockNightInfo({
        ...forecast.nightInfo,
        observingWindowMode: 'nautical',
      }),
    });

    render(
      <MilkyWayPlannerCard
        target={target}
        forecast={twilightForecast}
        forecastRange={[twilightForecast]}
        horizonProfile={createDefaultHorizonProfile()}
        location={location}
        onOpenDetails={vi.fn()}
        onShowSky={vi.fn()}
      />
    );

    expect(screen.getByText('No astronomical darkness')).toBeInTheDocument();
    expect(screen.queryByText('Best photo window')).not.toBeInTheDocument();
    expect(screen.getByText(/Sun never reaches 18° below/)).toBeInTheDocument();
  });
});
