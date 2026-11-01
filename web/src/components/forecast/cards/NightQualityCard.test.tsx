import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import NightQualityCard from '@/components/forecast/cards/NightQualityCard';
import { SkyCalculator } from '@/lib/astronomy/calculator';
import { createMockNightForecast, createMockNightInfo } from '@/test/factories';

const london = { latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London' };

describe('NightQualityCard', () => {
  it('keeps the explanation collapsed and reveals all twilight definitions on demand', () => {
    render(<NightQualityCard location={london} forecast={createMockNightForecast()} />);
    const explain = screen.getByRole('button', { name: 'Why this night rating?' });
    expect(explain).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/Civil twilight ·/)).not.toBeInTheDocument();
    fireEvent.click(explain);
    for (const label of [
      'Civil twilight · 0° to −6°',
      'Nautical twilight · −6° to −12°',
      'Astronomical twilight · −12° to −18°',
      'Astronomical night · Below −18°',
    ])
      expect(screen.getByText(label)).toBeInTheDocument();
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

  it('keeps twilight limits explicit when there is no astronomical night', () => {
    const forecast = createMockNightForecast({
      nightInfo: createMockNightInfo({
        astronomicalNightMode: 'none',
        observingWindowMode: 'nautical',
      }),
    });

    render(<NightQualityCard location={london} forecast={forecast} />);

    expect(screen.getByText(/No astronomical night/)).toBeInTheDocument();
    expect(screen.getByText(/Astronomical twilight window/)).toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: /night timeline scrubber/i })).toBeInTheDocument();
  });
});
