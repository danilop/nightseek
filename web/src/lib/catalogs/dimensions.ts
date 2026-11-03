import type { DimensionProvenance } from '@/types';

const sac = 'https://www.saguaroastro.org/wp-content/sac-docs/Book110BestNGC.pdf';
const corrections: Record<
  string,
  { major: number; minor: number; provenance: DimensionProvenance }
> = {
  NGC6960: {
    major: 70,
    minor: 6,
    provenance: {
      region: 'Western Veil filament',
      note: 'Approximate bright filament; adjacent faint emission extends farther. Replaces the broader LBN-derived OpenNGC footprint. References agree, but are not independent measurements.',
      sources: [
        { label: 'SAC · p. 53', url: `${sac}#page=60` },
        {
          label: 'JRASC · April 2000, p. 68',
          url: 'https://www.rasc.ca/sites/default/files/publications/JRASC-2000-04.pdf#page=30',
        },
      ],
    },
  },
  NGC7000: {
    major: 120,
    minor: 100,
    provenance: {
      region: 'North America Nebula',
      note: 'Approximate nebula footprint, excluding the Pelican Nebula. Faint emission boundaries vary by exposure and wavelength. Replaces the narrower LBN-derived OpenNGC entry.',
      sources: [
        { label: 'SAC · p. 54', url: `${sac}#page=61` },
        {
          label: 'RASC Calgary · Cygnus',
          url: 'https://calgary.rasc.ca/constellations/cygnus.htm',
        },
      ],
    },
  },
};

/** Region-specific corrections; never substitute dimensions of an associated complex. */
export function resolveCatalogDimensions(name: string, major: number | null, minor: number | null) {
  const correction = corrections[name];
  if (correction) return { ...correction, corrected: true };
  const validMajor = major !== null && Number.isFinite(major) && major > 0 ? major : null;
  const validMinor = minor !== null && Number.isFinite(minor) && minor > 0 ? minor : null;
  return {
    major: validMajor === null ? null : Math.max(validMajor, validMinor ?? 0),
    minor:
      validMajor === null ? null : validMinor === null ? null : Math.min(validMajor, validMinor),
    corrected: false,
    provenance: {
      region: name,
      note: 'Catalogue axes are approximate; emission boundaries and camera orientation affect framing.',
      sources: [{ label: 'OpenNGC', url: 'https://github.com/mattiaverga/OpenNGC' }],
    } satisfies DimensionProvenance,
  };
}
