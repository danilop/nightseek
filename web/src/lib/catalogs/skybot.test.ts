import { afterEach, describe, expect, it, vi } from 'vitest';
import { publicData, record } from '@/lib/api/public-data';
import { getCached, setCache } from '@/lib/utils/cache';
import { fetchSkybot } from './skybot';

vi.mock('@/lib/utils/cache', () => ({ getCached: vi.fn(), setCache: vi.fn() }));
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

describe('SkyBoT HTTP responses', () => {
  it('caches a documented 204 empty field as a successful empty result', async () => {
    vi.mocked(getCached).mockResolvedValue(null);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    expect(await fetchSkybot(322.9515, 48.44, 0.71, new Date('2026-10-31T18:52Z'))).toEqual([]);
    expect(setCache).toHaveBeenCalledWith(expect.stringContaining('skybot:'), []);
  });

  it.each([500, 400])('keeps HTTP %i failures distinct from an empty field', async status => {
    vi.mocked(getCached).mockResolvedValue(null);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status })));
    expect(await fetchSkybot(322.9515, 48.44, 0.71, new Date('2026-10-31T18:52Z'))).toBeNull();
    expect(setCache).not.toHaveBeenCalled();
  });

  it('does not interpret undocumented empty responses from other APIs as successful', async () => {
    vi.mocked(getCached).mockResolvedValue(null);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    expect(await publicData('other-api', 1000, 'https://example.test', record)).toBeNull();
    expect(setCache).not.toHaveBeenCalled();
  });
});
