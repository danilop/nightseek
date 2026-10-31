import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchNeoCloseApproachesRange, parseCloseApproachTime } from './neows';

// Exercise the live fallback independently of the generated bundle's date coverage.
vi.mock('@/data/neo.json', () => ({
  default: { startDate: '2000-01-01', endDate: '2000-01-01', data: {} },
}));

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
  vi.unstubAllEnvs();
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

describe('NeoWs UTC API buckets across device clock changes', () => {
  const transitions = [
    ['Europe/London', '2026-03-29T00:00:00Z'],
    ['Europe/London', '2026-10-24T23:30:00Z'],
    ['America/New_York', '2026-03-08T00:00:00Z'],
    ['America/New_York', '2026-10-31T23:30:00Z'],
  ];

  describe.each(transitions)('%s starting %s', (deviceTimezone, start) => {
    it.each([3, 10])('retains all %i UTC days and consecutive API batches', async days => {
      vi.stubEnv('TZ', deviceTimezone);
      const dateKey = (index: number) =>
        new Date(new Date(start).getTime() + index * 86_400_000).toISOString().slice(0, 10);
      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        const first = new Date(`${url.searchParams.get('start_date')}T00:00:00Z`).getTime();
        const last = new Date(`${url.searchParams.get('end_date')}T00:00:00Z`).getTime();
        const entries = [];
        for (let time = first; time <= last; time += 86_400_000) {
          const key = new Date(time).toISOString().slice(0, 10);
          entries.push([
            key,
            [
              {
                id: key,
                name: `(Asteroid ${key})`,
                absolute_magnitude_h: 22,
                is_potentially_hazardous_asteroid: false,
                estimated_diameter: {
                  kilometers: { estimated_diameter_min: 0.05, estimated_diameter_max: 0.1 },
                },
                close_approach_data: [
                  {
                    close_approach_date: key,
                    close_approach_date_full: `${key}T12:00:00Z`,
                    relative_velocity: { kilometers_per_hour: '40000' },
                    miss_distance: { lunar: '5', kilometers: '1922000' },
                  },
                ],
              },
            ],
          ]);
        }
        return new Response(
          JSON.stringify({
            element_count: entries.length,
            near_earth_objects: Object.fromEntries(entries),
          }),
          { status: 200 }
        );
      });
      vi.stubGlobal('fetch', fetchMock);
      const result = await fetchNeoCloseApproachesRange(new Date(start), days);
      const expectedKeys = Array.from({ length: days }, (_, i) => dateKey(i));
      expect([...result.keys()]).toEqual(expectedKeys);
      for (const key of expectedKeys) expect(result.get(key)?.map(neo => neo.neoId)).toEqual([key]);
      expect(fetchMock).toHaveBeenCalledTimes(Math.ceil(days / 7));
      fetchMock.mock.calls.forEach(([input], batch) => {
        const url = new URL(String(input));
        expect(url.searchParams.get('start_date')).toBe(dateKey(batch * 7));
        expect(url.searchParams.get('end_date')).toBe(dateKey(Math.min(days - 1, batch * 7 + 6)));
      });
    });
  });
});
