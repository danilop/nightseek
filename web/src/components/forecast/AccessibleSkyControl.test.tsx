import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, type Mock, vi } from 'vitest';
import type { HorizonAltitudeLevel } from '@/lib/utils/horizon-profile';
import { createDefaultHorizonProfile } from '@/lib/utils/horizon-profile';
import type { HorizonProfile, HorizonSectorLabel } from '@/types';
import AccessibleSkyControl from './AccessibleSkyControl';

beforeAll(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

const COLUMN_TOP = 100;
const COLUMN_HEIGHT = 160;

/** jsdom reports a zero-sized box, so the column geometry has to be faked. */
function stubColumnGeometry() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    top: COLUMN_TOP,
    bottom: COLUMN_TOP + COLUMN_HEIGHT,
    left: 0,
    right: 40,
    width: 40,
    height: COLUMN_HEIGHT,
    x: 0,
    y: COLUMN_TOP,
    toJSON: () => ({}),
  } as DOMRect);
}

/** clientY for a given altitude on the stubbed 0–90° column. */
function clientYForAltitude(altitude: number): number {
  return COLUMN_TOP + COLUMN_HEIGHT * (1 - altitude / 90);
}

function createProfile(overrides: Partial<Record<HorizonSectorLabel, number>> = {}) {
  const profile = createDefaultHorizonProfile();
  return {
    ...profile,
    sectors: profile.sectors.map(sector => ({
      ...sector,
      minAltitude: overrides[sector.label] ?? sector.minAltitude,
    })),
  } satisfies HorizonProfile;
}

type SetMinimumAltitude = Mock<(minimumAltitude: number) => void>;
type SetSectorAltitude = Mock<
  (sectorLabel: HorizonSectorLabel, minAltitude: HorizonAltitudeLevel) => void
>;
type Reset = Mock<() => void>;

function renderControl(
  handlers: {
    onSetMinimumAltitude?: SetMinimumAltitude;
    onSetSectorAltitude?: SetSectorAltitude;
    onReset?: Reset;
  } = {},
  horizonProfile: HorizonProfile = createProfile()
) {
  const props = {
    onSetMinimumAltitude: handlers.onSetMinimumAltitude ?? (vi.fn() as SetMinimumAltitude),
    onSetSectorAltitude: handlers.onSetSectorAltitude ?? (vi.fn() as SetSectorAltitude),
    onReset: handlers.onReset ?? (vi.fn() as Reset),
  };
  render(<AccessibleSkyControl horizonProfile={horizonProfile} {...props} />);
  return props;
}

function getDirectionSliders() {
  return within(
    screen.getByRole('group', { name: /horizon obstruction by direction/i })
  ).getAllByRole('slider');
}

function getDirectionSlider(label: string) {
  return screen.getByRole('slider', { name: new RegExp(`^${label} obstruction$`) });
}

describe('AccessibleSkyControl', () => {
  it('renders one slider per direction, reporting its obstruction level', () => {
    renderControl({}, createProfile({ SW: 30, N: 90 }));
    const sliders = getDirectionSliders();

    expect(sliders).toHaveLength(8);
    expect(getDirectionSlider('E')).toHaveAttribute('aria-valuetext', 'Open');
    expect(getDirectionSlider('E')).toHaveAttribute('aria-valuenow', '0');
    expect(getDirectionSlider('SW')).toHaveAttribute('aria-valuetext', '30°+');
    expect(getDirectionSlider('SW')).toHaveAttribute('aria-valuenow', '30');
    expect(getDirectionSlider('N')).toHaveAttribute('aria-valuetext', 'Blocked');
    expect(getDirectionSlider('N')).toHaveAttribute('data-blocked', 'true');
  });

  it('raises and lowers a direction with the arrow keys', () => {
    const { onSetSectorAltitude } = renderControl({
      onSetSectorAltitude: vi.fn() as SetSectorAltitude,
    });

    fireEvent.keyDown(getDirectionSlider('SW'), { key: 'ArrowUp' });
    expect(onSetSectorAltitude).toHaveBeenCalledWith('SW', 15);

    onSetSectorAltitude.mockClear();
    renderControl({ onSetSectorAltitude }, createProfile({ SW: 30 }));
    fireEvent.keyDown(screen.getAllByRole('slider', { name: /^SW obstruction$/ })[1], {
      key: 'ArrowDown',
    });
    expect(onSetSectorAltitude).toHaveBeenCalledWith('SW', 15);
  });

  it('does not fire at the ends of the level range', () => {
    const { onSetSectorAltitude } = renderControl(
      { onSetSectorAltitude: vi.fn() as SetSectorAltitude },
      createProfile({ S: 90, N: 0 })
    );

    fireEvent.keyDown(getDirectionSlider('S'), { key: 'ArrowUp' });
    fireEvent.keyDown(getDirectionSlider('N'), { key: 'ArrowDown' });

    expect(onSetSectorAltitude).not.toHaveBeenCalled();
  });

  it('jumps to open and blocked with Home and End', () => {
    const { onSetSectorAltitude } = renderControl(
      { onSetSectorAltitude: vi.fn() as SetSectorAltitude },
      createProfile({ S: 30 })
    );

    fireEvent.keyDown(getDirectionSlider('S'), { key: 'End' });
    expect(onSetSectorAltitude).toHaveBeenCalledWith('S', 90);

    fireEvent.keyDown(getDirectionSlider('S'), { key: 'Home' });
    expect(onSetSectorAltitude).toHaveBeenCalledWith('S', 0);
  });

  it('cycles through the levels with Enter', () => {
    const { onSetSectorAltitude } = renderControl(
      { onSetSectorAltitude: vi.fn() as SetSectorAltitude },
      createProfile({ S: 45 })
    );

    fireEvent.keyDown(getDirectionSlider('S'), { key: 'Enter' });
    expect(onSetSectorAltitude).toHaveBeenCalledWith('S', 90);
  });

  it('moves focus between directions without changing any value', () => {
    const { onSetSectorAltitude } = renderControl({
      onSetSectorAltitude: vi.fn() as SetSectorAltitude,
    });

    fireEvent.keyDown(getDirectionSlider('N'), { key: 'ArrowRight' });
    expect(getDirectionSlider('NE')).toHaveFocus();

    fireEvent.keyDown(getDirectionSlider('NE'), { key: 'ArrowLeft' });
    expect(getDirectionSlider('N')).toHaveFocus();

    fireEvent.keyDown(getDirectionSlider('N'), { key: 'ArrowLeft' });
    expect(getDirectionSlider('NW')).toHaveFocus();

    expect(onSetSectorAltitude).not.toHaveBeenCalled();
  });

  it('sets a direction to the level under the pointer', () => {
    stubColumnGeometry();
    const { onSetSectorAltitude } = renderControl({
      onSetSectorAltitude: vi.fn() as SetSectorAltitude,
    });

    fireEvent.pointerDown(getDirectionSlider('E'), {
      pointerType: 'mouse',
      pointerId: 1,
      clientY: clientYForAltitude(40),
    });

    // 40° snaps to the nearest configurable level.
    expect(onSetSectorAltitude).toHaveBeenCalledWith('E', 45);
  });

  it('only fires while dragging when the level actually changes', () => {
    stubColumnGeometry();
    const { onSetSectorAltitude } = renderControl({
      onSetSectorAltitude: vi.fn() as SetSectorAltitude,
    });
    const column = getDirectionSlider('E');

    fireEvent.pointerDown(column, {
      pointerType: 'mouse',
      pointerId: 1,
      clientY: clientYForAltitude(30),
    });
    onSetSectorAltitude.mockClear();

    // Same level — the profile prop has not re-rendered, so this is a no-op.
    fireEvent.pointerMove(column, {
      pointerType: 'mouse',
      pointerId: 1,
      clientY: clientYForAltitude(32),
    });
    expect(onSetSectorAltitude).not.toHaveBeenCalled();

    fireEvent.pointerMove(column, {
      pointerType: 'mouse',
      pointerId: 1,
      clientY: clientYForAltitude(60),
    });
    expect(onSetSectorAltitude).toHaveBeenCalledWith('E', 45);
  });

  it('ignores touch drags so the page can still scroll', () => {
    stubColumnGeometry();
    const { onSetSectorAltitude } = renderControl({
      onSetSectorAltitude: vi.fn() as SetSectorAltitude,
    });
    const column = getDirectionSlider('E');

    fireEvent.pointerDown(column, {
      pointerType: 'touch',
      pointerId: 1,
      clientY: clientYForAltitude(15),
    });
    onSetSectorAltitude.mockClear();

    fireEvent.pointerMove(column, {
      pointerType: 'touch',
      pointerId: 1,
      clientY: clientYForAltitude(90),
    });

    expect(onSetSectorAltitude).not.toHaveBeenCalled();
  });

  it('changes the whole-sky minimum altitude independently', () => {
    const { onSetMinimumAltitude } = renderControl({
      onSetMinimumAltitude: vi.fn() as SetMinimumAltitude,
    });

    fireEvent.change(screen.getByRole('slider', { name: /minimum target altitude/i }), {
      target: { value: '25' },
    });

    expect(onSetMinimumAltitude).toHaveBeenCalledWith(25);
  });

  it('draws the whole-sky minimum across the skyline only when one is set', () => {
    const { container } = render(
      <AccessibleSkyControl
        horizonProfile={{ ...createProfile(), minimumAltitude: 30 }}
        onSetMinimumAltitude={vi.fn()}
        onSetSectorAltitude={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(container.querySelector('[data-testid="whole-sky-minimum"]')).not.toBeNull();

    const { container: withoutMinimum } = render(
      <AccessibleSkyControl
        horizonProfile={createProfile()}
        onSetMinimumAltitude={vi.fn()}
        onSetSectorAltitude={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(withoutMinimum.querySelector('[data-testid="whole-sky-minimum"]')).toBeNull();
  });

  it('resets the whole profile', () => {
    const { onReset } = renderControl({ onReset: vi.fn() as Reset });

    fireEvent.click(screen.getByRole('button', { name: /reset/i }));

    expect(onReset).toHaveBeenCalled();
  });

  it('can follow the device heading when compass assist is enabled', async () => {
    class DeviceOrientationEventMock extends Event {
      static requestPermission = vi.fn().mockResolvedValue('granted');
      absolute: boolean;
      alpha: number | null;
      webkitCompassAccuracy?: number;
      webkitCompassHeading?: number;

      constructor(
        type: string,
        init?: {
          absolute?: boolean;
          alpha?: number | null;
          webkitCompassAccuracy?: number;
          webkitCompassHeading?: number;
        }
      ) {
        super(type);
        this.absolute = init?.absolute ?? false;
        this.alpha = init?.alpha ?? null;
        this.webkitCompassAccuracy = init?.webkitCompassAccuracy;
        this.webkitCompassHeading = init?.webkitCompassHeading;
      }
    }

    vi.stubGlobal('DeviceOrientationEvent', DeviceOrientationEventMock);
    const { onSetSectorAltitude } = renderControl({
      onSetSectorAltitude: vi.fn() as SetSectorAltitude,
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /use phone compass/i }));
    });

    act(() => {
      window.dispatchEvent(
        new DeviceOrientationEventMock('deviceorientation', {
          webkitCompassAccuracy: 8,
          webkitCompassHeading: 180,
        })
      );
    });

    const trackedSlider = await waitFor(() =>
      screen.getByRole('slider', { name: /^S obstruction, aligned with phone heading$/ })
    );

    fireEvent.keyDown(trackedSlider, { key: 'ArrowUp' });
    expect(onSetSectorAltitude).toHaveBeenCalledWith('S', 15);
  });
});
