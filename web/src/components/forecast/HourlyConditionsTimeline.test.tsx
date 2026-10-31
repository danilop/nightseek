import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockNightWeather } from '@/test/factories';
import type { HourlyWeather } from '@/types';
import HourlyConditionsTimeline from './HourlyConditionsTimeline';

function hour(overrides: Partial<HourlyWeather> = {}): HourlyWeather {
  return {
    cloudCover: 10,
    visibility: null,
    windSpeed: null,
    windGust: null,
    humidity: null,
    temperature: 10,
    dewPoint: 5,
    precipProbability: null,
    precipitation: null,
    pressure: null,
    cape: null,
    aod: null,
    pm25: null,
    pm10: null,
    dust: null,
    ...overrides,
  };
}

const firstOneAm = Date.parse('2026-11-01T05:00:00Z');
const secondOneAm = Date.parse('2026-11-01T06:00:00Z');
const firstLabel = 'Nov 1, 1:00 AM UTC-04:00';
const secondLabel = 'Nov 1, 1:00 AM UTC-05:00';

afterEach(() => vi.restoreAllMocks());

describe('HourlyConditionsTimeline', () => {
  it('keeps both New York fall-back hours distinct when rendering and updating', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const weather = createMockNightWeather({
      hourlyData: new Map([
        [firstOneAm, hour({ cloudCover: 10 })],
        [secondOneAm, hour({ cloudCover: 80 })],
      ]),
    });
    const { rerender } = render(
      <HourlyConditionsTimeline
        weather={weather}
        temperatureUnit="celsius"
        timezone="America/New_York"
      />
    );
    expect(screen.getAllByText('1a')).toHaveLength(2);
    expect(screen.getByTitle(firstLabel)).toHaveAttribute('dateTime', '2026-11-01T05:00:00.000Z');
    expect(screen.getByTitle(secondLabel)).toHaveAttribute('dateTime', '2026-11-01T06:00:00.000Z');
    expect(screen.getByText(firstLabel)).toHaveClass('sr-only');
    expect(screen.getByText(secondLabel)).toHaveClass('sr-only');
    const firstCloud = screen.getByTitle(`${firstLabel}: 10% clouds`);
    const secondCloud = screen.getByTitle(`${secondLabel}: 80% clouds`);
    expect(firstCloud).not.toBe(secondCloud);

    const updated = createMockNightWeather({
      hourlyData: new Map([
        [secondOneAm, hour({ cloudCover: 90 })],
        [firstOneAm, hour({ cloudCover: 20 })],
      ]),
    });
    rerender(
      <HourlyConditionsTimeline
        weather={updated}
        temperatureUnit="celsius"
        timezone="America/New_York"
      />
    );
    expect(screen.getByTitle(`${firstLabel}: 20% clouds`)).toBe(firstCloud);
    expect(screen.getByTitle(`${secondLabel}: 90% clouds`)).toBe(secondCloud);
    expect(screen.getAllByText('1a')).toHaveLength(2);
    expect(errors).not.toHaveBeenCalled();
  });

  it.each([
    { temperature: null, dewPoint: 5 },
    { temperature: 10, dewPoint: null },
    { temperature: null, dewPoint: null },
    { temperature: Number.NaN, dewPoint: 5 },
    { temperature: 10, dewPoint: Number.POSITIVE_INFINITY },
  ])('renders unknown dew risk instead of invented inputs for %j', inputs => {
    const weather = createMockNightWeather({ hourlyData: new Map([[firstOneAm, hour(inputs)]]) });
    render(
      <HourlyConditionsTimeline
        weather={weather}
        temperatureUnit="celsius"
        timezone="America/New_York"
      />
    );
    const dew = screen.getByTitle(
      `${firstLabel}: Dew risk unavailable — temperature or dew point missing`
    );
    expect(dew).toHaveClass('bg-gray-700');
    expect(dew).toHaveTextContent('——');
    expect(screen.queryByTitle(/° margin/)).not.toBeInTheDocument();
  });

  it('keeps a real zero-degree dew margin instead of treating zero as missing', () => {
    const weather = createMockNightWeather({
      hourlyData: new Map([[firstOneAm, hour({ temperature: 0, dewPoint: 0 })]]),
    });
    render(
      <HourlyConditionsTimeline
        weather={weather}
        temperatureUnit="celsius"
        timezone="America/New_York"
      />
    );
    const dew = screen.getByTitle(/0\.0° margin/);
    expect(dew).not.toHaveClass('bg-gray-700');
    expect(screen.queryByTitle(/Dew risk unavailable/)).not.toBeInTheDocument();
  });
});
