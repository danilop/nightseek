import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ExplainSection from '@/components/ui/ExplainSection';
import {
  createMockAstronomicalEvents,
  createMockNightForecast,
  createMockObjectVisibility,
  createMockScoredObject,
} from '@/test/factories';
import type { ImagingWindow } from '@/types';
import AstronomicalEventsSection from './AstronomicalEventsSection';
import ImagingWindowSummary from './ImagingWindowSummary';
import ObjectCard from './ObjectCard';
import TargetFrameDiagram from './TargetFrameDiagram';
import TonightPicksCard from './TonightPicksCard';

vi.mock('@/stores/AppContext', () => ({
  useApp: () => ({
    state: {
      location: { timezone: 'Europe/London' },
      settings: { telescope: 'dwarf_mini', customFOV: null },
    },
  }),
}));
vi.mock('@/hooks/useCurrentTime', () => ({
  useCurrentTime: () => new Date('2026-11-01T18:00:00Z'),
}));
const window: ImagingWindow = {
  start: new Date('2026-11-01T22:00:00Z'),
  end: new Date('2026-11-01T23:00:00Z'),
  quality: 'good',
  qualityScore: 75,
  factors: { altitude: 80, airmass: 80, moonInterference: 80, cloudCover: 80 },
};
const target = createMockScoredObject({
  objectName: 'M31',
  magnitude: 3.4,
  category: 'dso',
  visibility: createMockObjectVisibility({
    commonName: 'M31 Andromeda Galaxy',
    angularSizeArcmin: 180,
    minorAxisArcmin: 60,
    imagingWindow: window,
    imagingWindows: [window],
  }),
});

describe('visual disclosure and consistent summaries', () => {
  it('does not render expensive explanation content before it is requested', () => {
    const mounted = vi.fn();
    function Content() {
      mounted();
      return <p>Technical detail</p>;
    }
    render(
      <ExplainSection title="Why this rating?">
        <Content />
      </ExplainSection>
    );
    const toggle = screen.getByRole('button', { name: 'Why this rating?' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(mounted).not.toHaveBeenCalled();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Technical detail')).toBeVisible();
    fireEvent.click(toggle);
    expect(screen.queryByText('Technical detail')).not.toBeInTheDocument();
  });
  it('uses identical content in a target card and category leader', () => {
    const forecast = createMockNightForecast();
    render(
      <>
        <ObjectCard object={target} nightInfo={forecast.nightInfo} weather={forecast.weather} />
        <TonightPicksCard
          picks={[{ object: target, categoryLabel: 'Top galaxy', reason: '', keyStat: '' }]}
          onDismiss={() => {}}
          onObjectSelect={() => {}}
        />
      </>
    );
    const summaries = screen.getAllByTestId('target-summary');
    expect(within(summaries[0]).getByText('mag 3.4')).toBeVisible();
    expect(summaries[0].textContent).toBe(summaries[1].textContent);
    expect(within(summaries[0]).getByText('Extends beyond frame', { selector: 'p' })).toBeVisible();
    expect(within(summaries[0]).getByText('1h · short window')).toBeVisible();
  });
  it('shows a dimensioned schematic without a remote image request', () => {
    render(
      <TargetFrameDiagram major={180} minor={60} category="dso" fov={{ width: 128, height: 72 }} />
    );
    expect(screen.getByRole('img', { name: /Extends beyond frame/ })).toBeVisible();
    expect(screen.getByText(/FoV 2.13° × 1.2°/)).toBeVisible();
    expect(screen.getByText(/Schematic · long axes aligned/)).toBeVisible();
  });
  it('keeps weather-unavailable and no-window states explicit', () => {
    render(
      <ImagingWindowSummary window={null} weatherAvailable={false} timezone="Europe/London" />
    );
    expect(screen.getByText('Visibility only · weather unavailable')).toBeVisible();
    expect(screen.getByText('No remaining visibility window')).toBeVisible();
  });
  it('sorts event types together chronologically and puts explanations behind controls', () => {
    const events = createMockAstronomicalEvents({
      moonPhaseEvent: {
        daysUntil: 2,
        phase: 'full',
        time: new Date('2026-11-03T20:00:00Z'),
        isTonight: false,
      },
      spaceWeather: null,
    });
    const earlier = new Date('2026-11-02T20:00:00Z');
    const { container } = render(
      <AstronomicalEventsSection
        events={events}
        nightDate={new Date('2026-11-01T12:00:00Z')}
        conjunctions={[
          {
            object1Name: 'Mars',
            object2Name: 'Moon',
            time: earlier,
            separationDegrees: 4.6,
            isNotable: true,
            description: 'Nearby in the sky',
          },
        ]}
      />
    );
    const times = Array.from(container.querySelectorAll('[data-event-time]'), el =>
      el.getAttribute('data-event-time')
    );
    expect(times).toEqual([earlier.toISOString(), '2026-11-03T20:00:00.000Z']);
    expect(screen.queryByText('Nearby in the sky')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'About Mars – Moon' }));
    expect(screen.getByRole('img', { name: /4.6° angular separation/ })).toBeVisible();
    expect(screen.getByText(/local visibility not assessed/)).toBeVisible();
  });
});
