import { fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import ForecastEvidenceCard from '@/components/forecast/cards/ForecastEvidenceCard';
import { ensembleWindow, fetchEnsemble, parseEnsemble } from '@/lib/weather/ensemble';
import { fetchMetNorway } from '@/lib/weather/met-norway';
import { createMockNightForecast, createMockNightInfo } from './factories';

vi.mock('@/lib/weather/ensemble', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/weather/ensemble')>()),
  fetchEnsemble: vi.fn(),
}));
vi.mock('@/lib/weather/met-norway', () => ({ fetchMetNorway: vi.fn() }));

const night = createMockNightInfo({
  observingWindowStart: new Date(0),
  observingWindowEnd: new Date(7_200_000),
});

function response(gust: number | null = null, count = 40) {
  const hourly: Record<string, unknown> = { time: [0, 3600, 7200] };
  for (let i = 0; i < count; i++) {
    const suffix = i === 0 ? '' : `_member${String(i).padStart(2, '0')}`;
    hourly[`cloud_cover${suffix}`] = [5, 10, 15];
    hourly[`precipitation${suffix}`] = [0, 0, 0];
    hourly[`wind_gusts_10m${suffix}`] = [gust, gust, gust];
  }
  return { hourly };
}

describe('global ensemble coverage', () => {
  it('keeps all 40 cloud/rain members when the provider returns all-null gusts', () => {
    // Matches the ICON response shape captured for New York, Quito, Sydney,
    // Auckland and Honolulu on 31 October 2026.
    const parsed = parseEnsemble(response());
    expect(parsed.members.every(member => member.gusts.every(value => value === null))).toBe(true);
    expect(ensembleWindow(parsed, night)).toMatchObject({
      support: 40,
      members: 40,
      gustMembers: 0,
      gustsAssessed: false,
      cloudLow: 10,
      cloudHigh: 10,
    });
  });

  it('does not discard members whose gust field is absent', () => {
    const raw = response();
    for (const key of Object.keys(raw.hourly)) {
      if (key.startsWith('wind_gusts')) delete raw.hourly[key];
    }
    expect(ensembleWindow(parseEnsemble(raw), night)).toMatchObject({
      support: 40,
      members: 40,
      gustMembers: 0,
      gustsAssessed: false,
    });
  });

  it('uses gusts in support only when all valid cloud/rain members have complete gust hours', () => {
    const raw = response(10, 2);
    raw.hourly.wind_gusts_10m_member01 = [10, 50, 10];
    expect(ensembleWindow(parseEnsemble(raw), night)).toMatchObject({
      support: 1,
      members: 2,
      gustMembers: 2,
      gustsAssessed: true,
    });
    raw.hourly.wind_gusts_10m_member01 = [10, null, 10];
    expect(ensembleWindow(parseEnsemble(raw), night)).toMatchObject({
      support: 2,
      members: 2,
      gustMembers: 1,
      gustsAssessed: false,
    });
  });

  it.each([
    [-1, 0, 0],
    [0, Number.NaN, 0],
    [0, Number.POSITIVE_INFINITY, 0],
  ])('never interprets invalid gust values %j as calm wind', (first, second, third) => {
    const raw = response(10, 2);
    raw.hourly.wind_gusts_10m_member01 = [first, second, third];
    expect(ensembleWindow(parseEnsemble(raw), night)).toMatchObject({
      gustMembers: 1,
      gustsAssessed: false,
    });
  });

  it('still rejects missing cloud/rain coverage and counts missing members in the coverage denominator', () => {
    const raw = response();
    for (let i = 1; i <= 9; i++)
      delete raw.hourly[`precipitation_member${String(i).padStart(2, '0')}`];
    expect(parseEnsemble(raw).members).toHaveLength(40);
    expect(ensembleWindow(parseEnsemble(raw), night)).toBeNull();
  });

  it('requires every hour of the same interval to be clear and dry', () => {
    const raw = response(null, 2);
    raw.hourly.cloud_cover = [0, 50, 0];
    raw.hourly.precipitation_member01 = [0, 0.2, 0];
    expect(ensembleWindow(parseEnsemble(raw), night)).toMatchObject({
      support: 0,
      members: 2,
      gustsAssessed: false,
    });
  });

  it('rejects duplicate intermediate timestamps even when endpoints span two hours', () => {
    const raw = response();
    raw.hourly.time = [0, 0, 7200];
    expect(ensembleWindow(parseEnsemble(raw), night)).toBeNull();
  });

  it.each([false, true])(
    'renders the appropriate criteria when gust coverage is complete: %s',
    async complete => {
      vi.mocked(fetchEnsemble).mockResolvedValue(parseEnsemble(response(complete ? 10 : null)));
      vi.mocked(fetchMetNorway).mockResolvedValue(null);
      render(
        createElement(ForecastEvidenceCard, {
          forecast: createMockNightForecast({ nightInfo: night, weather: null }),
          location: { latitude: -33.8688, longitude: 151.2093, timezone: 'Australia/Sydney' },
        })
      );
      fireEvent.click(screen.getByRole('button', { name: 'Compare free weather forecasts' }));
      await screen.findByText(
        complete
          ? /40\/40 ICON members support clear, dry, low-gust conditions/
          : /40\/40 ICON members support clear, dry conditions/
      );
      if (complete) {
        expect(screen.queryByText(/Wind not assessed/)).not.toBeInTheDocument();
        expect(screen.getByText(/gusts <40 km\/h/)).toBeInTheDocument();
      } else {
        expect(
          screen.getByText(/Wind not assessed.*complete gust data for 0\/40 members/)
        ).toBeInTheDocument();
        expect(screen.queryByText(/low-gust|gusts <40/)).not.toBeInTheDocument();
      }
    }
  );
});
