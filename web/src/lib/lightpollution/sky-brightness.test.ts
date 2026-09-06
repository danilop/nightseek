import { afterEach, describe, expect, it, vi } from 'vitest';
import { atlasCell, isSkyglowFavourable, loadSkyBrightness, readAtlasCell } from './sky-brightness';

const cache = vi.hoisted(() => ({ getCached: vi.fn(), setCache: vi.fn() }));
vi.mock('@/lib/utils/cache', () => cache);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function gzip(bytes: Int8Array | Uint8Array) {
  const body = new Response(new Uint8Array(bytes)).body;
  if (!body) throw new Error('Missing test stream');
  return new Response(body.pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
}

function tile() {
  const bytes = new Int8Array(360001);
  bytes[0] = 1;
  bytes[1] = 72; // encoded value 200 at southwest corner
  return bytes;
}

describe('regional sky brightness atlas', () => {
  it('selects containing pixels across tile boundaries, poles and the date line', () => {
    expect(atlasCell(-65, -180)).toEqual({ key: '1_1', row: 0, column: 0 });
    expect(atlasCell(-65, 180)).toEqual(atlasCell(-65, -180));
    expect(atlasCell(-60.00000001, -175.00000001)).toEqual({ key: '1_1', row: 599, column: 599 });
    expect(atlasCell(-60, -175)).toEqual({ key: '2_2', row: 0, column: 0 });
    expect(atlasCell(74.999999, 179.999999)).toEqual({ key: '72_28', row: 599, column: 599 });
    for (const [lat, lon] of [
      [75, 0],
      [-66, 0],
      [NaN, 0],
      [0, Infinity],
      [0, 181],
    ]) {
      expect(atlasCell(lat, lon)).toBeNull();
    }
  });

  it('reconstructs signed row/column deltas and logarithmic total brightness', () => {
    const bytes = tile();
    bytes[2] = -20; // adjacent longitude must not affect next row's starting value
    bytes[601] = 10;
    bytes[602] = -10;
    expect(readAtlasCell(bytes, 1, 1).magnitudes).toBeCloseTo(21.12385251212111, 5);
    expect(readAtlasCell(bytes, 0, 1).magnitudes).toBeGreaterThan(
      readAtlasCell(bytes, 0, 0).magnitudes
    );
    expect(readAtlasCell(new Int8Array(360001), 599, 599)).toEqual({
      magnitudes: 22,
      artificialToNaturalRatio: 0,
    });
    expect(() => readAtlasCell(bytes, 600, 0)).toThrow();
    expect(() => readAtlasCell(new Int8Array(3), 0, 0)).toThrow();
  });

  it('shares a small regional download, omits credentials, and persists for offline use', async () => {
    cache.getCached.mockResolvedValue(null);
    const fetcher = vi.fn().mockResolvedValue(new Response(await gzip(tile())));
    vi.stubGlobal('fetch', fetcher);
    const values = await Promise.all([loadSkyBrightness(0, 0), loadSkyBrightness(0.01, 0.01)]);
    expect(values[0]?.magnitudes).toBeCloseTo(21.12385251212111, 5);
    expect(values[1]).toEqual(values[0]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toContain('/2025/binary_tile_37_14.dat.gz');
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    expect(cache.setCache).toHaveBeenCalledTimes(1);
  });

  it('uses a cached region without a network request', async () => {
    cache.getCached.mockResolvedValue({ key: '1_1', bytes: tile() });
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect(await loadSkyBrightness(-65, -180)).not.toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('returns unknown on failures or corrupt tiles and allows a later retry', async () => {
    cache.getCached.mockResolvedValue(null);
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response(await gzip(new Uint8Array(3))))
      .mockResolvedValueOnce(new Response(await gzip(tile())));
    vi.stubGlobal('fetch', fetcher);
    expect(await loadSkyBrightness(10, 10)).toBeNull();
    expect(await loadSkyBrightness(10, 10)).toBeNull();
    expect(await loadSkyBrightness(10, 10)).not.toBeNull();
    expect(await loadSkyBrightness(80, 0)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('never treats missing sky data as favourable', () => {
    expect(isSkyglowFavourable(null)).toBe(false);
    expect(isSkyglowFavourable(NaN)).toBe(false);
    expect(isSkyglowFavourable(19.9)).toBe(false);
    expect(isSkyglowFavourable(20)).toBe(true);
    expect(isSkyglowFavourable(21.5)).toBe(true);
  });
});
