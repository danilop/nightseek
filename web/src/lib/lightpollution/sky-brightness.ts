import { getCached, setCache } from '@/lib/utils/cache';

export const SKY_ATLAS_YEAR = 2025;
const TILE_SIDE = 600;
const TILE_BYTES = TILE_SIDE * TILE_SIDE + 1;
const CACHE_KEY = `nightseek:sky-atlas:${SKY_ATLAS_YEAR}`;
const tiles = new Map<string, Promise<Int8Array>>();

export interface SkyBrightness {
  /** Modeled total zenith brightness, assuming a natural sky of 22 mag/arcsec². */
  magnitudes: number;
  artificialToNaturalRatio: number;
}

/** Half-open geographic cells avoid the atlas viewer's rounding overflow at tile edges. */
export function atlasCell(latitude: number, longitude: number) {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -65 ||
    latitude >= 75 ||
    longitude < -180 ||
    longitude > 180
  )
    return null;
  const x = (longitude + 180) % 360;
  const y = latitude + 65;
  const tileX = Math.floor(x / 5);
  const tileY = Math.floor(y / 5);
  return {
    key: `${tileX + 1}_${tileY + 1}`,
    column: Math.min(599, Math.floor((x - tileX * 5) * 120)),
    row: Math.min(599, Math.floor((y - tileY * 5) * 120)),
  };
}

/** Decode the published atlas delta format, not the colors of a rendered map.
 * Format reference: astronomy/lp/overlay/dark.html on the source website.
 * Each row's first delta is relative to the previous row's first value.
 */
export function readAtlasCell(bytes: Int8Array, row: number, column: number): SkyBrightness {
  if (
    bytes.length !== TILE_BYTES ||
    !Number.isInteger(row) ||
    !Number.isInteger(column) ||
    row < 0 ||
    row >= TILE_SIDE ||
    column < 0 ||
    column >= TILE_SIDE
  ) {
    throw new Error('Invalid sky atlas tile');
  }
  let encoded = 128 * bytes[0] + bytes[1];
  for (let y = 1; y <= row; y++) encoded += bytes[TILE_SIDE * y + 1];
  for (let x = 1; x <= column; x++) encoded += bytes[TILE_SIDE * row + 1 + x];
  const artificialToNaturalRatio = (5 / 195) * Math.expm1(0.0195 * encoded);
  const magnitudes = 22 - 2.5 * Math.log10(1 + artificialToNaturalRatio);
  if (!Number.isFinite(magnitudes) || artificialToNaturalRatio < 0 || magnitudes < 0) {
    throw new Error('Invalid sky brightness');
  }
  return { magnitudes, artificialToNaturalRatio };
}

async function downloadTile(key: string): Promise<Int8Array> {
  // Persist only the last region: ~360 KB, bounded even after many location changes.
  const cached = await getCached<{ key: string; bytes: Int8Array }>(CACHE_KEY, 365 * 86400_000);
  if (
    cached?.key === key &&
    cached.bytes instanceof Int8Array &&
    cached.bytes.length === TILE_BYTES
  ) {
    return cached.bytes;
  }
  // Use the author’s original files on the host allowed by both document and CDN CSP.
  const response = await fetch(
    `https://raw.githubusercontent.com/djlorenz/djlorenz.github.io/master/astronomy/binary_tiles/${SKY_ATLAS_YEAR}/binary_tile_${key}.dat.gz`,
    { signal: AbortSignal.timeout(12_000), credentials: 'omit', referrerPolicy: 'no-referrer' }
  );
  if (!response.ok) throw new Error('Sky atlas unavailable');
  const compressed = await response.arrayBuffer();
  if (compressed.byteLength > 512_000) throw new Error('Sky atlas download too large');
  const body = new Response(compressed).body;
  if (!body) throw new Error('Sky atlas response is empty');
  const stream = body.pipeThrough(new DecompressionStream('gzip'));
  const bytes = new Int8Array(await new Response(stream).arrayBuffer());
  if (bytes.length !== TILE_BYTES) throw new Error('Invalid sky atlas tile');
  await setCache(CACHE_KEY, { key, bytes });
  return bytes;
}

export async function loadSkyBrightness(
  latitude: number,
  longitude: number
): Promise<SkyBrightness | null> {
  const cell = atlasCell(latitude, longitude);
  if (!cell) return null;
  let pending = tiles.get(cell.key);
  if (!pending) {
    pending = downloadTile(cell.key);
    tiles.set(cell.key, pending);
    // Bound in-memory regional data too. Both header layouts and the planner share requests.
    const oldest = tiles.keys().next().value;
    if (tiles.size > 4 && oldest !== undefined) tiles.delete(oldest);
  }
  try {
    return readAtlasCell(await pending, cell.row, cell.column);
  } catch {
    if (tiles.get(cell.key) === pending) tiles.delete(cell.key);
    return null;
  }
}

/** A planning threshold, not a conversion to observational Bortle classes. */
export function isSkyglowFavourable(magnitudes: number | null): boolean {
  return magnitudes !== null && Number.isFinite(magnitudes) && magnitudes >= 20;
}
