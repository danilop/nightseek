import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useHorizonProfile } from '@/hooks/useHorizonProfile';
import type { Location } from '@/types';

const getCached = vi.hoisted(() => vi.fn());
const setCache = vi.hoisted(() => vi.fn());
const location = vi.hoisted(
  () => ({ latitude: 51.5074, longitude: -0.1278 }) as unknown as Location
);

vi.mock('@/lib/utils/cache', () => ({
  getCached,
  setCache,
  CACHE_KEYS: { HORIZON_PREFIX: 'nightseek:horizon:' },
}));

vi.mock('@/stores/AppContext', () => ({
  useApp: () => ({ state: { location } }),
}));

beforeEach(() => {
  getCached.mockReset().mockResolvedValue(null);
  setCache.mockReset().mockResolvedValue(undefined);
});

describe('useHorizonProfile', () => {
  it('starts open and reports readiness once the stored profile is read', async () => {
    const { result } = renderHook(() => useHorizonProfile());

    expect(result.current.horizonProfile.minimumAltitude).toBe(0);
    expect(result.current.horizonProfile.sectors).toHaveLength(8);

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(getCached).toHaveBeenCalledWith(
      'nightseek:horizon:51.50740,-0.12780',
      Number.POSITIVE_INFINITY
    );
  });

  it('normalizes a stored profile into canonical sector order', async () => {
    getCached.mockResolvedValue({
      minimumAltitude: 200,
      sectors: [{ label: 'S', centerAzimuth: 180, minAltitude: 30 }],
    });

    const { result } = renderHook(() => useHorizonProfile());
    await waitFor(() => expect(result.current.isReady).toBe(true));

    // Clamped to the 60° whole-sky ceiling.
    expect(result.current.horizonProfile.minimumAltitude).toBe(60);
    expect(result.current.horizonProfile.sectors.map(sector => sector.label)).toEqual([
      'N',
      'NE',
      'E',
      'SE',
      'S',
      'SW',
      'W',
      'NW',
    ]);
    expect(
      result.current.horizonProfile.sectors.find(sector => sector.label === 'S')?.minAltitude
    ).toBe(30);
  });

  it('persists every edit', async () => {
    const { result } = renderHook(() => useHorizonProfile());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    setCache.mockClear();

    act(() => result.current.setSectorAltitude('SW', 45));

    await waitFor(() => expect(setCache).toHaveBeenCalled());
    const [key, saved] = setCache.mock.calls[setCache.mock.calls.length - 1];
    expect(key).toBe('nightseek:horizon:51.50740,-0.12780');
    expect(
      saved.sectors.find((sector: { label: string }) => sector.label === 'SW').minAltitude
    ).toBe(45);
  });

  it('updates the whole-sky minimum without touching the sectors', async () => {
    const { result } = renderHook(() => useHorizonProfile());
    await waitFor(() => expect(result.current.isReady).toBe(true));

    act(() => result.current.setMinimumAltitude(25));

    expect(result.current.horizonProfile.minimumAltitude).toBe(25);
    expect(result.current.horizonProfile.sectors.every(sector => sector.minAltitude === 0)).toBe(
      true
    );
  });

  it('restores the open default on reset', async () => {
    getCached.mockResolvedValue({
      minimumAltitude: 30,
      sectors: [{ label: 'N', centerAzimuth: 0, minAltitude: 90 }],
    });

    const { result } = renderHook(() => useHorizonProfile());
    await waitFor(() => expect(result.current.isReady).toBe(true));

    act(() => result.current.reset());

    expect(result.current.horizonProfile.minimumAltitude).toBe(0);
    expect(result.current.horizonProfile.sectors.every(sector => sector.minAltitude === 0)).toBe(
      true
    );
  });

  it('does not write anything before the stored profile has loaded', () => {
    // A read that never settles keeps the hook in its not-ready state.
    getCached.mockReturnValue(new Promise(() => undefined));

    renderHook(() => useHorizonProfile());

    expect(setCache).not.toHaveBeenCalled();
  });
});
