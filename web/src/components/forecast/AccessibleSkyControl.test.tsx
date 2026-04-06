import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createDefaultHorizonProfile } from '@/lib/utils/horizon-profile';
import AccessibleSkyControl from './AccessibleSkyControl';

class ResizeObserverMock {
  observe() {}
  disconnect() {}
  unobserve() {}
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);

  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    value(options?: ScrollToOptions | number) {
      this.scrollLeft = typeof options === 'number' ? options : (options?.left ?? 0);
    },
  });
});

describe('AccessibleSkyControl', () => {
  it('cycles the centered sector when its tile is pressed', () => {
    const handleCycle = vi.fn();

    render(
      <AccessibleSkyControl
        horizonProfile={createDefaultHorizonProfile()}
        onCycleSector={handleCycle}
        onReset={vi.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /^n, open, centered under the heading marker\. press to change blockage\./i,
      })
    );

    expect(handleCycle).toHaveBeenCalledWith('N');
  });

  it('moves focus with the keyboard before cycling the sector', () => {
    const handleCycle = vi.fn();

    render(
      <AccessibleSkyControl
        horizonProfile={createDefaultHorizonProfile()}
        onCycleSector={handleCycle}
        onReset={vi.fn()}
      />
    );

    const activeNorth = screen.getByRole('button', {
      name: /^n, open, centered under the heading marker\. press to change blockage\./i,
    });
    fireEvent.keyDown(activeNorth, { key: 'ArrowRight' });

    const activeNorthEast = screen.getByRole('button', {
      name: /^ne, open, centered under the heading marker\. press to change blockage\./i,
    });
    fireEvent.keyDown(activeNorthEast, { key: 'Enter' });

    expect(handleCycle).toHaveBeenCalledWith('NE');
  });

  it('cycles an off-center tile on the first tap', () => {
    const handleCycle = vi.fn();

    render(
      <AccessibleSkyControl
        horizonProfile={createDefaultHorizonProfile()}
        onCycleSector={handleCycle}
        onReset={vi.fn()}
      />
    );

    const southTile = screen.getAllByRole('button', {
      name: /^s, open, press to change blockage\./i,
    })[0];

    fireEvent.click(southTile);
    expect(handleCycle).toHaveBeenCalledWith('S');
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

    render(
      <AccessibleSkyControl
        horizonProfile={createDefaultHorizonProfile()}
        onCycleSector={vi.fn()}
        onReset={vi.fn()}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /use phone compass/i }));
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /stop compass/i })).toBeInTheDocument();
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
        screen.getByRole('button', {
          name: /^s, open, centered under the heading marker\. press to change blockage\./i,
        })
      ).toBeInTheDocument();
    });
  });
});
