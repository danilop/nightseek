import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchNeoCloseApproachesRange, parseCloseApproachTime } from './neows';

vi.mock('../utils/cache', async importOriginal => {
  const original = await importOriginal<typeof import('../utils/cache')>();
  return {
    ...original,
    getCached: vi.fn(async () => null),
    setCache: vi.fn(async () => undefined),
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('NeoWs close-approach timestamps', () => {
  it('parses NASA date_full values as UTC rather than the browser timezone', () => {
    expect(parseCloseApproachTime('2026-Jan-15 23:42').toISOString()).toBe(
      '2026-01-15T23:42:00.000Z'
    );
  });

  it('pads UTC queries so a late UTC encounter is retained on the observer civil date', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL) =>
        new Response(
          JSON.stringify({
            element_count: 1,
            near_earth_objects: {
              '2040-01-03': [
                {
                  id: 'boundary-object',
                  name: '(2040 AB)',
                  absolute_magnitude_h: 22,
                  is_potentially_hazardous_asteroid: false,
                  estimated_diameter: {
                    kilometers: { estimated_diameter_min: 0.05, estimated_diameter_max: 0.1 },
                  },
                  close_approach_data: [
                    {
                      close_approach_date: '2040-01-03',
                      close_approach_date_full: '2040-Jan-03 05:00',
                      relative_velocity: { kilometers_per_hour: '40000' },
                      miss_distance: { lunar: '5', kilometers: '1922000' },
                    },
                  ],
                },
              ],
            },
          }),
          { status: 200 }
        )
    );
    vi.stubGlobal('fetch', fetchMock);

    // 22:00 UTC is noon on Jan 2 in Honolulu. The 05:00 UTC Jan 3
    // encounter still belongs to the observer's Jan 2 civil date.
    const result = await fetchNeoCloseApproachesRange(
      new Date('2040-01-02T22:00:00Z'),
      1,
      'Pacific/Honolulu'
    );

    expect(result.get('2040-01-02')?.map(approach => approach.neoId)).toEqual(['boundary-object']);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('start_date=2040-01-01');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('end_date=2040-01-03');
  });
});
