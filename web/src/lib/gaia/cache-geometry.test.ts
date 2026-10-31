import { afterEach, expect, it, vi } from 'vitest';
import { getCached } from '@/lib/utils/cache';
import { fetchGaiaStarField } from './api';
import { fetchEnhancedGaiaStarField } from './enhanced-queries';

vi.mock('@/lib/utils/cache', async importOriginal => ({
  ...(await importOriginal<object>()),
  getCached: vi.fn(),
}));
afterEach(() => vi.resetAllMocks());
it.each([fetchGaiaStarField, fetchEnhancedGaiaStarField])(
  'separates same-name requests with different centres and radii',
  async fetcher => {
    vi.mocked(getCached).mockResolvedValue({
      fetchedAt: new Date().toISOString(),
      _searchRadius: 10,
      stars: [],
    });
    await fetcher(1, 2, 0.5, 'M31');
    await fetcher(1, 2, 1, 'M31');
    await fetcher(2, 2, 0.5, 'M31');
    await fetcher(1, 3, 0.5, 'M31');
    const keys = vi.mocked(getCached).mock.calls.map(args => args[0]);
    expect(new Set(keys).size).toBe(4);
  }
);
