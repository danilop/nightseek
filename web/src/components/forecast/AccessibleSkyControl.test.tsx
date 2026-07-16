import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createDefaultHorizonProfile } from '@/lib/utils/horizon-profile';
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

describe('AccessibleSkyControl', () => {
  it('shows all directions and applies an explicit obstruction level', () => {
    const handleSetSectorAltitude = vi.fn();

    render(
      <AccessibleSkyControl
        horizonProfile={createDefaultHorizonProfile()}
        onSetMinimumAltitude={vi.fn()}
        onSetSectorAltitude={handleSetSectorAltitude}
        onReset={vi.fn()}
      />
    );

    expect(screen.getAllByRole('button', { name: /^[nesw]{1,2}, open/i })).toHaveLength(8);
    fireEvent.click(screen.getByRole('button', { name: /^sw, open/i }));
    fireEvent.click(screen.getByRole('button', { name: /^30°\+$/i }));

    expect(handleSetSectorAltitude).toHaveBeenCalledWith('SW', 30);
  });

  it('changes the whole-sky minimum altitude independently', () => {
    const handleSetMinimumAltitude = vi.fn();

    render(
      <AccessibleSkyControl
        horizonProfile={createDefaultHorizonProfile()}
        onSetMinimumAltitude={handleSetMinimumAltitude}
        onSetSectorAltitude={vi.fn()}
        onReset={vi.fn()}
      />
    );

    fireEvent.change(screen.getByRole('slider', { name: /minimum target altitude/i }), {
      target: { value: '25' },
    });

    expect(handleSetMinimumAltitude).toHaveBeenCalledWith(25);
  });

  it('moves the selected direction with arrow keys', () => {
    const handleSetSectorAltitude = vi.fn();

    render(
      <AccessibleSkyControl
        horizonProfile={createDefaultHorizonProfile()}
        onSetMinimumAltitude={vi.fn()}
        onSetSectorAltitude={handleSetSectorAltitude}
        onReset={vi.fn()}
      />
    );

    fireEvent.keyDown(screen.getByRole('button', { name: /^n, open/i }), {
      key: 'ArrowRight',
    });
    fireEvent.click(screen.getByRole('button', { name: /^45°\+$/i }));

    expect(handleSetSectorAltitude).toHaveBeenCalledWith('NE', 45);
  });

  it('can follow the device heading when compass assist is enabled', async () => {
    const handleSetSectorAltitude = vi.fn();

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

    render(
      <AccessibleSkyControl
        horizonProfile={createDefaultHorizonProfile()}
        onSetMinimumAltitude={vi.fn()}
        onSetSectorAltitude={handleSetSectorAltitude}
        onReset={vi.fn()}
      />
    );

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

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /^s, open, aligned with phone heading$/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^45°\+$/i }));
    expect(handleSetSectorAltitude).toHaveBeenCalledWith('S', 45);
  });
});
