import harris from '@/data/harris-magnitudes.json';
import type { DSOSubtype } from '@/types';
import { hasMagnitude } from '../utils/magnitude';

/** Prefer specialist integrated cluster photometry; never a member star or nearby source. */
export function resolveCatalogMagnitude(
  name: string,
  type: DSOSubtype,
  primary: number | null,
  raHours: number,
  decDegrees: number,
  primaryBand: 'V' | 'B' | null
): { magnitude: number | null; source?: string } {
  const fallback = hasMagnitude(primary)
    ? { magnitude: primary, source: `OpenNGC · ${primaryBand ?? 'optical'} band` }
    : { magnitude: null };
  if (type !== 'globular_cluster') return fallback;
  const match = /^(NGC|IC)\s*0*(\d+)$/i.exec(name);
  if (!match) return fallback;
  const id = `${match[1].toUpperCase()}${Number(match[2])}`;
  const entry = (
    harris.clusters as Record<string, { raDegrees: number; decDegrees: number; vMagnitude: number }>
  )[id];
  if (!entry || !Number.isFinite(raHours) || !Number.isFinite(decDegrees)) return fallback;
  const rad = Math.PI / 180;
  const haversine =
    Math.sin(((decDegrees - entry.decDegrees) * rad) / 2) ** 2 +
    Math.cos(decDegrees * rad) *
      Math.cos(entry.decDegrees * rad) *
      Math.sin(((raHours * 15 - entry.raDegrees) * rad) / 2) ** 2;
  const separationArcmin = ((2 * Math.asin(Math.sqrt(Math.min(1, haversine)))) / rad) * 60;
  if (separationArcmin > 2) return fallback;
  return { magnitude: entry.vMagnitude, source: `${harris.citation} · integrated V band` };
}
