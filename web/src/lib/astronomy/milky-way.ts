import type {
  MilkyWayBandSample,
  MilkyWayPlan,
  MilkyWaySection,
  NightInfo,
  ObjectVisibility,
} from '@/types';
import type { SkyCalculator } from './calculator';

interface MilkyWaySectionDefinition {
  id: string;
  label: string;
  description: string;
  galacticLongitudeDeg: number;
  relativeProminence: number;
}

/**
 * Representative regions around the Galactic plane. Prominence is deliberately
 * relative rather than a magnitude: the Milky Way is extended, structured light
 * whose contrast depends strongly on sky conditions and image scale.
 */
const MILKY_WAY_SECTIONS: readonly MilkyWaySectionDefinition[] = [
  {
    id: 'sagittarius-scorpius',
    label: 'Sagittarius–Scorpius',
    description: 'Bright central bulge, dust lanes, and rich star clouds.',
    galacticLongitudeDeg: 0,
    relativeProminence: 1,
  },
  {
    id: 'scutum-star-cloud',
    label: 'Scutum Star Cloud',
    description: 'A dense, bright northern extension of the central Milky Way.',
    galacticLongitudeDeg: 28,
    relativeProminence: 0.95,
  },
  {
    id: 'aquila',
    label: 'Aquila band',
    description: 'A broad summer band crossed by prominent dark lanes.',
    galacticLongitudeDeg: 48,
    relativeProminence: 0.72,
  },
  {
    id: 'cygnus',
    label: 'Cygnus band',
    description: 'A bright northern star field split by the Great Rift.',
    galacticLongitudeDeg: 80,
    relativeProminence: 0.88,
  },
  {
    id: 'cassiopeia',
    label: 'Cassiopeia band',
    description: 'A structured northern band rich in emission regions.',
    galacticLongitudeDeg: 120,
    relativeProminence: 0.7,
  },
  {
    id: 'perseus-auriga',
    label: 'Perseus–Auriga',
    description: 'A fainter winter section with clusters and nebulae.',
    galacticLongitudeDeg: 160,
    relativeProminence: 0.56,
  },
  {
    id: 'monoceros',
    label: 'Monoceros winter band',
    description: 'A subtle outer-Galaxy band requiring especially dark skies.',
    galacticLongitudeDeg: 210,
    relativeProminence: 0.43,
  },
  {
    id: 'puppis-vela',
    label: 'Puppis–Vela',
    description: 'A southern band with rich star fields and broad structure.',
    galacticLongitudeDeg: 250,
    relativeProminence: 0.68,
  },
  {
    id: 'carina',
    label: 'Carina band',
    description: 'A bright southern section with complex dust and nebulae.',
    galacticLongitudeDeg: 285,
    relativeProminence: 0.88,
  },
  {
    id: 'crux-centaurus',
    label: 'Crux–Centaurus',
    description: 'A prominent southern section near the Coalsack.',
    galacticLongitudeDeg: 310,
    relativeProminence: 0.93,
  },
  {
    id: 'scorpius',
    label: 'Scorpius band',
    description: 'The bright approach to the central bulge and dust lanes.',
    galacticLongitudeDeg: 345,
    relativeProminence: 0.96,
  },
] as const;

const BAND_LATITUDE_SAMPLES = [-5, 0, 5] as const;

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Convert IAU Galactic coordinates to ICRS/J2000 equatorial coordinates.
 * Uses the transpose of the standard J2000 equatorial-to-Galactic rotation.
 */
export function galacticToEquatorial(
  galacticLongitudeDeg: number,
  galacticLatitudeDeg: number
): { raHours: number; decDegrees: number } {
  const longitude = degreesToRadians(galacticLongitudeDeg);
  const latitude = degreesToRadians(galacticLatitudeDeg);
  const cosLatitude = Math.cos(latitude);
  const galactic = [
    cosLatitude * Math.cos(longitude),
    cosLatitude * Math.sin(longitude),
    Math.sin(latitude),
  ];

  const x = -0.0548755604 * galactic[0] + 0.4941094279 * galactic[1] - 0.867666149 * galactic[2];
  const y = -0.8734370902 * galactic[0] - 0.44482963 * galactic[1] - 0.1980763734 * galactic[2];
  const z = -0.4838350155 * galactic[0] + 0.7469822445 * galactic[1] + 0.4559837762 * galactic[2];

  const raDegrees = (radiansToDegrees(Math.atan2(y, x)) + 360) % 360;
  return {
    raHours: raDegrees / 15,
    decDegrees: radiansToDegrees(Math.asin(Math.max(-1, Math.min(1, z)))),
  };
}

function createBandSample(
  calculator: SkyCalculator,
  nightInfo: NightInfo,
  section: MilkyWaySectionDefinition,
  galacticLatitudeDeg: number
): MilkyWayBandSample {
  const { raHours, decDegrees } = galacticToEquatorial(
    section.galacticLongitudeDeg,
    galacticLatitudeDeg
  );
  const visibility = calculator.calculateVisibility(
    raHours,
    decDegrees,
    nightInfo,
    'Milky Way',
    'milky_way',
    {
      commonName: section.label,
      constellation: section.label,
    }
  );

  return { galacticLatitudeDeg, visibility };
}

export function calculateMilkyWayPlan(
  calculator: SkyCalculator,
  nightInfo: NightInfo
): MilkyWayPlan {
  const sections: MilkyWaySection[] = MILKY_WAY_SECTIONS.map(section => ({
    ...section,
    samples: BAND_LATITUDE_SAMPLES.map(latitude =>
      createBandSample(calculator, nightInfo, section, latitude)
    ),
  }));

  return {
    sections,
    coreVisibility: calculator.calculateGalacticCoreVisibility(nightInfo),
  };
}

/** Choose a useful generic target before the user's site obstruction profile is applied in UI. */
export function selectMilkyWayRepresentative(plan: MilkyWayPlan): ObjectVisibility {
  let best: { visibility: ObjectVisibility; score: number } | null = null;

  for (const section of plan.sections) {
    for (const sample of section.samples) {
      const visibility = sample.visibility;
      const score =
        Math.max(0, visibility.maxAltitude) * (0.65 + section.relativeProminence * 0.35);
      if (!best || score > best.score) best = { visibility, score };
    }
  }

  return (
    best?.visibility ?? {
      ...plan.coreVisibility,
      objectName: 'Milky Way',
      commonName: 'Milky Way',
    }
  );
}
