import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { createMockAstronomicalEvents } from '@/test/factories';
import EventsSection from './EventsSection';

vi.mock('./AstronomicalEventsSection', () => ({
  default: () => <div>Source health and NOAA reports</div>,
}));
it('keeps the source-health card available when DONKI has no events', () => {
  const astronomicalEvents = createMockAstronomicalEvents({
    spaceWeather: { fetchedAt: '2026-09-29T00:00:00Z', geomagneticStorms: [], solarFlares: [] },
  });
  render(
    <EventsSection
      conjunctions={[]}
      meteorShowers={[]}
      astronomicalEvents={astronomicalEvents}
      latitude={51.5074}
      nightDate={new Date('2026-10-31T12:00:00Z')}
    />
  );
  expect(screen.getByText('Source health and NOAA reports')).toBeInTheDocument();
});
