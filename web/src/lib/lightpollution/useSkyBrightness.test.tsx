import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { loadSkyBrightness, type SkyBrightness } from './sky-brightness';
import { useSkyBrightness } from './useSkyBrightness';

vi.mock('./sky-brightness', () => ({ loadSkyBrightness: vi.fn() }));
afterEach(() => vi.clearAllMocks());

it('refreshes after loading and never displays a result from an old location', async () => {
  const resolve: Array<(value: SkyBrightness | null) => void> = [];
  vi.mocked(loadSkyBrightness).mockImplementation(() => new Promise(done => resolve.push(done)));
  const { result, rerender } = renderHook(({ lat }) => useSkyBrightness(lat, 0), {
    initialProps: { lat: 10 },
  });
  expect(result.current).toEqual({ data: null, loading: true });
  rerender({ lat: 20 });
  await act(async () => resolve[1]({ magnitudes: 21, artificialToNaturalRatio: 1.5 }));
  expect(result.current.data?.magnitudes).toBe(21);
  await act(async () => resolve[0]({ magnitudes: 18, artificialToNaturalRatio: 39 }));
  expect(result.current.data?.magnitudes).toBe(21);
  rerender({ lat: 30 });
  expect(result.current).toEqual({ data: null, loading: true });
  await act(async () => resolve[2](null));
  expect(result.current).toEqual({ data: null, loading: false });
});

it('retries unavailable data when connectivity returns', async () => {
  vi.mocked(loadSkyBrightness)
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ magnitudes: 20.5, artificialToNaturalRatio: 3 });
  const { result } = renderHook(() => useSkyBrightness(40, 0));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.data).toBeNull();
  await act(async () => window.dispatchEvent(new Event('online')));
  await waitFor(() => expect(result.current.data?.magnitudes).toBe(20.5));
});
