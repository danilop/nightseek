import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCached, setCache } from '@/lib/utils/cache';
import { publicData, record } from './public-data';

vi.mock('@/lib/utils/cache', () => ({ getCached: vi.fn(), setCache: vi.fn() }));
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});
describe('optional public data', () => {
  it('uses a successful offline cache without making a network call', async () => {
    vi.mocked(getCached).mockResolvedValue({ value: 42 });
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect(await publicData('cached', 1000, 'https://example.test', record)).toEqual({ value: 42 });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('deduplicates concurrent requests', async () => {
    vi.mocked(getCached).mockResolvedValue(null);
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ value: 42 }) });
    vi.stubGlobal('fetch', fetcher);
    const result = await Promise.all([
      publicData('shared', 1000, 'https://example.test', record),
      publicData('shared', 1000, 'https://example.test', record),
    ]);
    expect(result).toEqual([{ value: 42 }, { value: 42 }]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('does not cache an outage or a malformed response as an empty successful result', async () => {
    vi.mocked(getCached).mockResolvedValue(null);
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', fetcher);
    expect(await publicData('failure', 1000, 'https://example.test', record)).toBeNull();
    expect(await publicData('failure', 1000, 'https://example.test', record)).toBeNull();
    expect(setCache).not.toHaveBeenCalled();
  });
});
