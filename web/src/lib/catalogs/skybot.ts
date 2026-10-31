import { numeric, publicData, record } from '@/lib/api/public-data';
export interface FieldBody {
  name: string;
  kind: string;
  magnitude: number | null;
  ra: string;
  dec: string;
  motionRa: number | null;
  motionDec: number | null;
}
export function parseSkybot(raw: unknown): FieldBody[] {
  if (!Array.isArray(raw)) throw new Error('Invalid SkyBoT response');
  return raw
    .map(value => {
      const r = record(value);
      if (
        typeof r.Name !== 'string' ||
        typeof r['RA (hms)'] !== 'string' ||
        typeof r['DEC (dms)'] !== 'string'
      )
        throw new Error('Unknown SkyBoT row schema');
      return {
        name: r.Name,
        kind: String(r.Class ?? 'Small body'),
        magnitude: numeric(r['VMag (mag)']),
        ra: r['RA (hms)'],
        dec: r['DEC (dms)'],
        motionRa: numeric(r['dRA (arcsec/h)']),
        motionDec: numeric(r['dDEC (arcsec/h)']),
      };
    })
    .sort((a, b) => (a.magnitude ?? 99) - (b.magnitude ?? 99));
}
export function fetchSkybot(
  raDegrees: number,
  decDegrees: number,
  radiusDegrees: number,
  time: Date
) {
  if (
    ![raDegrees, decDegrees, radiusDegrees, time.getTime()].every(Number.isFinite) ||
    radiusDegrees <= 0 ||
    radiusDegrees > 10
  )
    return Promise.resolve(null);
  const params = new URLSearchParams({
    '-ra': String(raDegrees),
    '-dec': String(decDegrees),
    '-rd': String(radiusDegrees),
    '-ep': String(time.getTime() / 86_400_000 + 2440587.5),
    '-mime': 'json',
    '-output': 'basic',
    '-loc': '500',
  });
  return publicData(
    `skybot:${params}`,
    24 * 3_600_000,
    `https://ssp.imcce.fr/webservices/skybot/api/conesearch.php?${params}`,
    parseSkybot,
    // SkyBoT documents HTTP 204 as a successful search with no matching objects.
    { parseNoContent: () => [] }
  );
}
