import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { formatInTimeZone } from 'date-fns-tz';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TargetAltitudeChart from '@/components/forecast/TargetAltitudeChart';
import TargetReferencePanel from '@/components/forecast/TargetReferencePanel';
import { fetchSkybot } from '@/lib/catalogs/skybot';
import {
  createDefaultHorizonProfile,
  evaluateTargetAccessibility,
} from '@/lib/utils/horizon-profile';
import { resolveLocalMinute } from '@/lib/utils/local-time';
import {
  createMockNightInfo,
  createMockObjectVisibility,
  createMockScoredObject,
} from './factories';

vi.mock('@/lib/catalogs/skybot', () => ({ fetchSkybot: vi.fn() }));

const transitions = [
  {
    city: 'London',
    timezone: 'Europe/London',
    instant: '2026-03-29T01:00:00Z',
    gap: '2026-03-29T01:30',
  },
  {
    city: 'London',
    timezone: 'Europe/London',
    instant: '2026-10-25T01:00:00Z',
    fold: '2026-10-25T01:30',
  },
  {
    city: 'New York',
    timezone: 'America/New_York',
    instant: '2026-03-08T07:00:00Z',
    gap: '2026-03-08T02:30',
  },
  {
    city: 'New York',
    timezone: 'America/New_York',
    instant: '2026-11-01T06:00:00Z',
    fold: '2026-11-01T01:30',
  },
  {
    city: 'Sydney',
    timezone: 'Australia/Sydney',
    instant: '2026-10-03T16:00:00Z',
    gap: '2026-10-04T02:30',
  },
  {
    city: 'Sydney',
    timezone: 'Australia/Sydney',
    instant: '2026-04-04T16:00:00Z',
    fold: '2026-04-05T02:30',
  },
  {
    city: 'Auckland',
    timezone: 'Pacific/Auckland',
    instant: '2026-09-26T14:00:00Z',
    gap: '2026-09-27T02:30',
  },
  {
    city: 'Auckland',
    timezone: 'Pacific/Auckland',
    instant: '2026-04-04T14:00:00Z',
    fold: '2026-04-05T02:30',
  },
];
const folds = transitions.filter(transition => transition.fold);
const gaps = transitions.filter(transition => transition.gap);

beforeEach(() => vi.mocked(fetchSkybot).mockReset().mockResolvedValue([]));

describe('exact daylight-saving transition instants', () => {
  it.each(transitions)(
    '$city $instant: resolves actual instants across +/- one hour',
    transition => {
      const change = new Date(transition.instant).getTime();
      for (const minute of [-60, -30, -1, 0, 1, 30, 60]) {
        const instant = new Date(change + minute * 60_000);
        const local = formatInTimeZone(instant, transition.timezone, "yyyy-MM-dd'T'HH:mm");
        expect(
          resolveLocalMinute(local, transition.timezone).map(date => date.toISOString())
        ).toContain(instant.toISOString());
      }
    }
  );

  it.each(transitions)(
    '$city $instant: chart scrubbing follows elapsed time through the clock jump',
    transition => {
      const change = new Date(transition.instant).getTime();
      const start = new Date(change - 3_600_000);
      const end = new Date(change + 3_600_000);
      const night = createMockNightInfo({
        sunset: start,
        sunrise: end,
        astronomicalDusk: start,
        astronomicalDawn: end,
      });
      const visibility = createMockObjectVisibility({
        altitudeSamples: [
          [start, 20],
          [new Date(change), 40],
          [end, 60],
        ],
        azimuthSamples: [
          [start, 180],
          [end, 180],
        ],
      });
      const horizon = createDefaultHorizonProfile();
      render(
        <TargetAltitudeChart
          visibility={visibility}
          nightInfo={night}
          horizonProfile={horizon}
          accessibility={evaluateTargetAccessibility(visibility, horizon, null)}
          calculator={null}
          timezone={transition.timezone}
        />
      );
      const slider = screen.getByRole('slider', { name: 'Scrub the altitude chart' });
      for (const [position, altitude] of [
        [0, 20],
        [250, 30],
        [500, 40],
        [750, 50],
        [1000, 60],
      ]) {
        // A nonzero previous value ensures the initial zero also fires a change.
        fireEvent.change(slider, { target: { value: String(position === 0 ? 1 : 0) } });
        fireEvent.change(slider, { target: { value: String(position) } });
        const instant = new Date(start.getTime() + (position / 1000) * 7_200_000);
        expect(slider.getAttribute('aria-valuetext')).toContain(
          formatInTimeZone(instant, transition.timezone, 'h:mm a')
        );
        expect(slider.getAttribute('aria-valuetext')).toContain(`${altitude}°`);
      }
    }
  );

  it.each(folds)('$city: distinguishes both occurrences of $fold', transition => {
    const change = new Date(transition.instant).getTime();
    expect(
      resolveLocalMinute(transition.fold ?? '', transition.timezone).map(date => date.getTime())
    ).toEqual([change - 30 * 60_000, change + 30 * 60_000]);
  });

  it.each(gaps)('$city: rejects nonexistent $gap', transition => {
    expect(resolveLocalMinute(transition.gap ?? '', transition.timezone)).toEqual([]);
  });
});

describe('SkyBoT exposure selection on transition nights', () => {
  const object = createMockScoredObject({ subtype: null });

  it.each(folds)(
    '$city: preserves the selected second occurrence, including seconds',
    async transition => {
      const second = new Date(new Date(transition.instant).getTime() + 30 * 60_000 + 27_000);
      render(
        <TargetReferencePanel
          object={object}
          width={60}
          height={60}
          time={second}
          timezone={transition.timezone}
        />
      );
      expect(screen.getByRole('combobox', { name: 'Exposure time occurrence' })).toHaveValue(
        String(second.getTime() - 27_000)
      );
      expect(screen.getByRole('option', { name: /Second occurrence/ })).toHaveTextContent(
        /UTC[+-]\d\d:\d\d/
      );
      fireEvent.click(screen.getByRole('button', { name: 'Find asteroids and comets' }));
      await waitFor(() => expect(fetchSkybot).toHaveBeenCalledTimes(1));
      expect(vi.mocked(fetchSkybot).mock.calls[0][3]).toEqual(second);
    }
  );

  it.each(gaps)('$city: disables SkyBoT for a local time in the skipped hour', transition => {
    render(
      <TargetReferencePanel
        object={object}
        width={60}
        height={60}
        time={new Date(transition.instant)}
        timezone={transition.timezone}
      />
    );
    fireEvent.change(screen.getByLabelText(/Exposure time \(/), {
      target: { value: transition.gap },
    });
    expect(screen.getByRole('alert')).toHaveTextContent('This local time does not exist');
    expect(screen.getByRole('button', { name: 'Find asteroids and comets' })).toBeDisabled();
    expect(fetchSkybot).not.toHaveBeenCalled();
  });

  it('lets the user explicitly change to the first occurrence', async () => {
    render(
      <TargetReferencePanel
        object={object}
        width={60}
        height={60}
        time={new Date('2026-10-25T01:30:00Z')}
        timezone="Europe/London"
      />
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'Exposure time occurrence' }), {
      target: { value: String(Date.parse('2026-10-25T00:30:00Z')) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Find asteroids and comets' }));
    await waitFor(() => expect(fetchSkybot).toHaveBeenCalledTimes(1));
    expect(vi.mocked(fetchSkybot).mock.calls[0][3].toISOString()).toBe('2026-10-25T00:30:00.000Z');
  });

  it('updates the selected instant when the selected target night changes', async () => {
    const { rerender } = render(
      <TargetReferencePanel
        object={object}
        width={60}
        height={60}
        time={new Date('2026-10-25T00:30:00Z')}
        timezone="Europe/London"
      />
    );
    rerender(
      <TargetReferencePanel
        object={object}
        width={60}
        height={60}
        time={new Date('2026-10-25T01:30:00Z')}
        timezone="Europe/London"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Find asteroids and comets' }));
    await waitFor(() => expect(fetchSkybot).toHaveBeenCalledTimes(1));
    expect(vi.mocked(fetchSkybot).mock.calls[0][3].toISOString()).toBe('2026-10-25T01:30:00.000Z');
  });
});
