import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NightQualityCard from '@/components/forecast/cards/NightQualityCard';
import { SkyCalculator } from '@/lib/astronomy/calculator';
import type { NightInfo } from '@/types';
import { createMockNightForecast } from './factories';

const london = { latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London' };
const newYork = { latitude: 40.7128, longitude: -74.006, timezone: 'America/New_York' };
const scenarios = [
  {
    name: 'London spring',
    location: london,
    nightDate: '2026-03-28',
    transition: '2026-03-29T01:00:00Z',
    shift: 1,
    before: '12:30 AM',
    after: '2:30 AM',
    minuteBefore: '12:59 AM',
    minuteAfter: '2:01 AM',
  },
  {
    name: 'London autumn',
    location: london,
    nightDate: '2026-10-24',
    transition: '2026-10-25T01:00:00Z',
    shift: -1,
    before: '1:30 AM (UTC+01:00)',
    after: '1:30 AM (UTC+00:00)',
    minuteBefore: '1:59 AM (UTC+01:00)',
    minuteAfter: '1:01 AM (UTC+00:00)',
  },
  {
    name: 'New York spring',
    location: newYork,
    nightDate: '2026-03-07',
    transition: '2026-03-08T07:00:00Z',
    shift: 1,
    before: '1:30 AM',
    after: '3:30 AM',
    minuteBefore: '1:59 AM',
    minuteAfter: '3:01 AM',
  },
  {
    name: 'New York autumn',
    location: newYork,
    nightDate: '2026-10-31',
    transition: '2026-11-01T06:00:00Z',
    shift: -1,
    before: '1:30 AM (UTC-04:00)',
    after: '1:30 AM (UTC-05:00)',
    minuteBefore: '1:59 AM (UTC-04:00)',
    minuteAfter: '1:01 AM (UTC-05:00)',
  },
];
const hour = 3_600_000;
function percentage(time: number, night: NightInfo) {
  return (
    ((time - night.sunset.getTime()) / (night.sunrise.getTime() - night.sunset.getTime())) * 100
  );
}
function localClockTimestamp(time: Date, timezone: string) {
  return Date.parse(`${formatInTimeZone(time, timezone, "yyyy-MM-dd'T'HH:mm:ss")}Z`);
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe.each(scenarios)('$name: the exact clock-change observing night', scenario => {
  const { location } = scenario;
  const night = new SkyCalculator(location.latitude, location.longitude).getNightInfo(
    fromZonedTime(`${scenario.nightDate}T12:00:00`, location.timezone)
  );
  const transition = Date.parse(scenario.transition);
  function renderNight() {
    return render(
      <NightQualityCard
        forecast={createMockNightForecast({ nightInfo: night, weather: null })}
        location={location}
        timezone={location.timezone}
      />
    );
  }

  it('scrubs forward through the skipped or repeated hour using absolute elapsed time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(transition - 2 * hour));
    renderNight();
    const slider = screen.getByRole('slider', { name: 'Night timeline scrubber' });
    // Fifteen seconds past the minute avoids floating-point millisecond rounding at
    // the exact minute boundary obscuring what this rendering test is checking.
    const before = transition - hour / 2 + 15_000;
    const after = transition + hour / 2 + 15_000;
    fireEvent.change(slider, { target: { value: percentage(before, night).toString() } });
    expect(screen.getByText(scenario.before)).toBeInTheDocument();
    expect(slider.getAttribute('aria-valuetext')).toContain(scenario.before);
    const firstPosition = Number((slider as HTMLInputElement).value);
    fireEvent.change(slider, { target: { value: percentage(after, night).toString() } });
    expect(screen.getByText(scenario.after)).toBeInTheDocument();
    expect(slider.getAttribute('aria-valuetext')).toContain(scenario.after);
    expect(screen.queryByText(scenario.before)).not.toBeInTheDocument();
    const secondPosition = Number((slider as HTMLInputElement).value);
    const nightDuration = night.sunrise.getTime() - night.sunset.getTime();
    expect(secondPosition).toBeGreaterThan(firstPosition);
    expect(((secondPosition - firstPosition) / 100) * nightDuration).toBeCloseTo(hour, 3);
    expect(screen.getByRole('button', { name: 'Now' })).toBeEnabled();
  });

  it('tracks Now monotonically from one minute before to one minute after the change', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(transition - 60_000));
    renderNight();
    const slider = screen.getByRole('slider', { name: 'Night timeline scrubber' });
    expect(screen.getByText(scenario.minuteBefore)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Now' })).toBeDisabled();
    const firstPosition = Number((slider as HTMLInputElement).value);
    act(() => vi.advanceTimersByTime(120_000));
    expect(screen.getByText(scenario.minuteAfter)).toBeInTheDocument();
    expect(slider.getAttribute('aria-valuetext')).toContain(scenario.minuteAfter);
    expect(screen.queryByText(scenario.minuteBefore)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Now' })).toBeDisabled();
    const lastPosition = Number((slider as HTMLInputElement).value);
    expect(lastPosition).toBeGreaterThan(firstPosition);
    const nightDuration = night.sunrise.getTime() - night.sunset.getTime();
    expect(((lastPosition - firstPosition) / 100) * nightDuration).toBeCloseTo(120_000, 3);
  });

  it('explains the clock change and displays actual dark hours rather than wall-clock subtraction', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(transition - hour));
    renderNight();
    fireEvent.click(screen.getByRole('button', { name: 'Why this night rating?' }));
    const elapsed = (night.astronomicalDawn.getTime() - night.astronomicalDusk.getTime()) / hour;
    const clockHours =
      (localClockTimestamp(night.astronomicalDawn, location.timezone) -
        localClockTimestamp(night.astronomicalDusk, location.timezone)) /
      hour;
    expect(clockHours - elapsed).toBeCloseTo(scenario.shift, 3);
    expect(screen.getByText(`${elapsed.toFixed(1)}h`)).toBeInTheDocument();
    expect(screen.queryByText(`${clockHours.toFixed(1)}h`)).not.toBeInTheDocument();
    expect(
      screen.getByText(
        `Clocks move ${scenario.shift > 0 ? 'forward' : 'back'} 1h. Durations use elapsed time; repeated times show their UTC offset.`
      )
    ).toBeInTheDocument();
  });
});
