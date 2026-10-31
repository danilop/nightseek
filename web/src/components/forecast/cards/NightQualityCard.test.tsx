import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import NightQualityCard from '@/components/forecast/cards/NightQualityCard';
import { SkyCalculator } from '@/lib/astronomy/calculator';
import { createMockNightForecast, createMockNightInfo } from '@/test/factories';

const london = { latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London' };

describe('NightQualityCard', () => {
  it('renders the four twilight legend entries', () => {
    render(<NightQualityCard location={london} forecast={createMockNightForecast()} />);

    for (const label of ['Civil', 'Nautical', 'Astro', 'Night']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('lists every twilight phase with its Sun-altitude range in the guide', () => {
    render(<NightQualityCard location={london} forecast={createMockNightForecast()} />);

    expect(screen.getByText('Civil twilight')).toBeInTheDocument();
    expect(screen.getByText('0° to −6°')).toBeInTheDocument();
    expect(screen.getByText('Nautical twilight')).toBeInTheDocument();
    expect(screen.getByText('−6° to −12°')).toBeInTheDocument();
    expect(screen.getByText('Astronomical twilight')).toBeInTheDocument();
    expect(screen.getByText('−12° to −18°')).toBeInTheDocument();
    expect(screen.getByText('Astronomical night')).toBeInTheDocument();
    expect(screen.getByText('Below −18°')).toBeInTheDocument();
  });

  it('reports astronomical night when the scrubber sits mid-night', () => {
    render(<NightQualityCard location={london} forecast={createMockNightForecast()} />);

    fireEvent.change(screen.getByRole('slider', { name: /night timeline scrubber/i }), {
      target: { value: '50' },
    });

    expect(screen.getByText('Astronomical Night')).toBeInTheDocument();
    expect(screen.getByText(/Sun \d+° below horizon/)).toBeInTheDocument();
  });

  it('reports civil twilight at the start of the night', () => {
    render(<NightQualityCard location={london} forecast={createMockNightForecast()} />);

    fireEvent.change(screen.getByRole('slider', { name: /night timeline scrubber/i }), {
      target: { value: '0' },
    });

    expect(screen.getByText('Civil Twilight')).toBeInTheDocument();
  });

  it('uses the actual London Sun depth rather than the diagram interpolation', () => {
    const nightInfo = new SkyCalculator(london.latitude, london.longitude).getNightInfo(
      new Date('2026-10-31T12:00Z')
    );
    render(
      <NightQualityCard location={london} forecast={createMockNightForecast({ nightInfo })} />
    );
    fireEvent.change(screen.getByRole('slider', { name: /night timeline scrubber/i }), {
      target: { value: '50' },
    });
    expect(screen.getByText(/Sun 5\d° below horizon/)).toBeInTheDocument();
  });

  it('replaces the scrubber with an explanation when there is no astronomical night', () => {
    const forecast = createMockNightForecast({
      nightInfo: createMockNightInfo({
        astronomicalNightMode: 'none',
        observingWindowMode: 'nautical',
      }),
    });

    render(<NightQualityCard location={london} forecast={forecast} />);

    expect(screen.getByText(/No astronomical night/)).toBeInTheDocument();
    expect(screen.getByText(/Astronomical twilight window/)).toBeInTheDocument();
    expect(
      screen.queryByRole('slider', { name: /night timeline scrubber/i })
    ).not.toBeInTheDocument();
  });
});
