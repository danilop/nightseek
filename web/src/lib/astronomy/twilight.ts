import type { NightInfo } from '@/types';

/**
 * Twilight phases shared by the Overview night timeline and the target
 * altitude chart. Both views must describe the same night identically, so the
 * phase table, the boundary maths and the gradient live here rather than in
 * either component.
 */
export type TwilightPhaseId = 'civil' | 'nautical' | 'astronomical' | 'night';

export interface TwilightPhaseStyle {
  id: TwilightPhaseId;
  /** Title-case name used by the scrubber readout. */
  label: string;
  /** Sentence-case name used by the twilight guide. */
  guideLabel: string;
  /** Compact name used by the legend. */
  shortLabel: string;
  /** Scrubber description. */
  description: string;
  /** Guide description — deliberately worded differently from `description`. */
  guideDescription: string;
  /** Sun-altitude range shown in the guide. */
  guideRange: string;
  /** Hex used by the gradient and by the chart's band fills. */
  color: string;
  /** Text colour for the scrubber phase line. */
  textClass: string;
  /** Background colour for the guide's four-part bar. */
  guideBgClass: string;
  /** Degrees below the horizon at the bright edge of the band. */
  altBase: number;
}

export const TWILIGHT_PHASES: Record<TwilightPhaseId, TwilightPhaseStyle> = {
  civil: {
    id: 'civil',
    label: 'Civil Twilight',
    guideLabel: 'Civil twilight',
    shortLabel: 'Civil',
    description: 'Horizon visible, brightest stars appearing',
    guideDescription: 'Bright horizon; only the brightest objects stand out',
    guideRange: '0° to −6°',
    color: '#ea580c',
    textClass: 'text-orange-400',
    guideBgClass: 'bg-orange-400',
    altBase: 0,
  },
  nautical: {
    id: 'nautical',
    label: 'Nautical Twilight',
    guideLabel: 'Nautical twilight',
    shortLabel: 'Nautical',
    description: 'Horizon fading, most stars visible',
    guideDescription: 'Most bright stars are visible',
    guideRange: '−6° to −12°',
    color: '#d97706',
    textClass: 'text-amber-400',
    guideBgClass: 'bg-amber-500',
    altBase: 6,
  },
  astronomical: {
    id: 'astronomical',
    label: 'Astronomical Twilight',
    guideLabel: 'Astronomical twilight',
    shortLabel: 'Astro',
    description: 'Sky nearly dark, deep-sky becoming viable',
    guideDescription: 'Nearly dark, but faint targets still lose contrast',
    guideRange: '−12° to −18°',
    color: '#3b82f6',
    textClass: 'text-blue-400',
    guideBgClass: 'bg-blue-600',
    altBase: 12,
  },
  night: {
    id: 'night',
    label: 'Astronomical Night',
    guideLabel: 'Astronomical night',
    shortLabel: 'Night',
    description: 'Full darkness — ideal for deep-sky imaging',
    guideDescription: 'Full natural darkness',
    guideRange: 'Below −18°',
    color: '#4f46e5',
    textClass: 'text-indigo-400',
    guideBgClass: 'bg-indigo-950',
    altBase: 18,
  },
};

/** Brightest to darkest, as the guide and legend present them. */
export const TWILIGHT_GUIDE_ORDER: readonly TwilightPhaseId[] = [
  'civil',
  'nautical',
  'astronomical',
  'night',
];

export interface TwilightBoundaries {
  civilDuskFraction: number;
  nauticalDuskFraction: number;
  astronomicalDuskFraction: number;
  astronomicalDawnFraction: number;
  nauticalDawnFraction: number;
  civilDawnFraction: number;
  /** True when at least one civil/nautical boundary fell back to interpolation. */
  isApproximate: boolean;
}

export interface TwilightBand {
  startFraction: number;
  endFraction: number;
  phase: TwilightPhaseId;
  /** True on the dawn side, where the sky is brightening. */
  reverse: boolean;
}

/** Fraction of the sunset→sunrise span at which a time falls (clamped 0–1). */
export function nightFraction(time: Date, sunset: Date, sunrise: Date): number {
  const total = sunrise.getTime() - sunset.getTime();
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, (time.getTime() - sunset.getTime()) / total));
}

/** Inverse of {@link nightFraction}. */
export function fractionToTime(fraction: number, sunset: Date, sunrise: Date): Date {
  const startMs = sunset.getTime();
  return new Date(startMs + fraction * (sunrise.getTime() - startMs));
}

function optionalFraction(
  time: Date | null | undefined,
  sunset: Date,
  sunrise: Date
): number | null {
  if (!time || !Number.isFinite(time.getTime())) return null;
  return nightFraction(time, sunset, sunrise);
}

/**
 * Real −6°/−12° times when the ephemeris found them, otherwise the sunset→dusk
 * span split into equal thirds. The fallback keeps high-latitude nights — where
 * the Sun never reaches those altitudes — rendering sensibly.
 */
export function getTwilightBoundaries(nightInfo: NightInfo): TwilightBoundaries {
  if (nightInfo.astronomicalNightMode === 'continuous') {
    return {
      civilDuskFraction: 0,
      nauticalDuskFraction: 0,
      astronomicalDuskFraction: 0,
      astronomicalDawnFraction: 1,
      nauticalDawnFraction: 1,
      civilDawnFraction: 1,
      isApproximate: false,
    };
  }

  const { sunset, sunrise } = nightInfo;
  const duskFraction = nightFraction(nightInfo.astronomicalDusk, sunset, sunrise);
  const dawnFraction = nightFraction(nightInfo.astronomicalDawn, sunset, sunrise);

  const realCivilDusk = optionalFraction(nightInfo.civilDusk, sunset, sunrise);
  const realNauticalDusk = optionalFraction(nightInfo.nauticalDusk, sunset, sunrise);
  const realNauticalDawn = optionalFraction(nightInfo.nauticalDawn, sunset, sunrise);
  const realCivilDawn = optionalFraction(nightInfo.civilDawn, sunset, sunrise);

  const raw = [
    realCivilDusk ?? duskFraction / 3,
    realNauticalDusk ?? (duskFraction * 2) / 3,
    duskFraction,
    dawnFraction,
    realNauticalDawn ?? dawnFraction + (1 - dawnFraction) / 3,
    realCivilDawn ?? dawnFraction + ((1 - dawnFraction) * 2) / 3,
  ];

  // Real boundaries can land outside the sunset→sunrise domain at high
  // latitude, which would otherwise produce inverted bands.
  let previous = 0;
  const ordered = raw.map(value => {
    previous = Math.max(previous, Math.min(1, value));
    return previous;
  });

  return {
    civilDuskFraction: ordered[0],
    nauticalDuskFraction: ordered[1],
    astronomicalDuskFraction: ordered[2],
    astronomicalDawnFraction: ordered[3],
    nauticalDawnFraction: ordered[4],
    civilDawnFraction: ordered[5],
    isApproximate:
      realCivilDusk === null ||
      realNauticalDusk === null ||
      realNauticalDawn === null ||
      realCivilDawn === null,
  };
}

/**
 * Contiguous bands covering [0, 1], brightest at both ends. Zero-width bands
 * are dropped, so a night without full darkness has no `night` band.
 */
export function getTwilightBands(boundaries: TwilightBoundaries): TwilightBand[] {
  const {
    civilDuskFraction,
    nauticalDuskFraction,
    astronomicalDuskFraction,
    astronomicalDawnFraction,
    nauticalDawnFraction,
    civilDawnFraction,
  } = boundaries;

  const bands: TwilightBand[] = [
    { startFraction: 0, endFraction: civilDuskFraction, phase: 'civil', reverse: false },
    {
      startFraction: civilDuskFraction,
      endFraction: nauticalDuskFraction,
      phase: 'nautical',
      reverse: false,
    },
    {
      startFraction: nauticalDuskFraction,
      endFraction: astronomicalDuskFraction,
      phase: 'astronomical',
      reverse: false,
    },
    {
      startFraction: astronomicalDuskFraction,
      endFraction: astronomicalDawnFraction,
      phase: 'night',
      reverse: false,
    },
    {
      startFraction: astronomicalDawnFraction,
      endFraction: nauticalDawnFraction,
      phase: 'astronomical',
      reverse: true,
    },
    {
      startFraction: nauticalDawnFraction,
      endFraction: civilDawnFraction,
      phase: 'nautical',
      reverse: true,
    },
    { startFraction: civilDawnFraction, endFraction: 1, phase: 'civil', reverse: true },
  ];

  return bands.filter(band => band.endFraction > band.startFraction);
}

/** Colour stops for the horizontal night gradient, in percent. */
export function getTwilightGradientCss(boundaries: TwilightBoundaries): string {
  const {
    civilDuskFraction,
    nauticalDuskFraction,
    astronomicalDuskFraction,
    astronomicalDawnFraction,
    nauticalDawnFraction,
    civilDawnFraction,
  } = boundaries;

  return `linear-gradient(to right,
    ${TWILIGHT_PHASES.civil.color} 0%,
    ${TWILIGHT_PHASES.nautical.color} ${civilDuskFraction * 100}%,
    ${TWILIGHT_PHASES.astronomical.color} ${nauticalDuskFraction * 100}%,
    ${TWILIGHT_PHASES.night.color} ${astronomicalDuskFraction * 100}%,
    ${TWILIGHT_PHASES.night.color} ${astronomicalDawnFraction * 100}%,
    ${TWILIGHT_PHASES.astronomical.color} ${nauticalDawnFraction * 100}%,
    ${TWILIGHT_PHASES.nautical.color} ${civilDawnFraction * 100}%,
    ${TWILIGHT_PHASES.civil.color} 100%)`;
}

export interface TwilightPhaseAtTime {
  phase: TwilightPhaseStyle;
  /** Human-readable Sun depth, e.g. "24° below horizon". */
  sunAltitudeLabel: string;
}

/**
 * The phase covering a fraction of the night, with an interpolated Sun depth.
 * The depth is derived from the band geometry, not from an ephemeris call.
 */
export function getTwilightPhaseAtFraction(
  fraction: number,
  boundaries: TwilightBoundaries
): TwilightPhaseAtTime {
  const { astronomicalDuskFraction, astronomicalDawnFraction } = boundaries;

  if (fraction >= astronomicalDuskFraction && fraction <= astronomicalDawnFraction) {
    const midFraction = (astronomicalDuskFraction + astronomicalDawnFraction) / 2;
    const halfSpan = (astronomicalDawnFraction - astronomicalDuskFraction) / 2;
    const distanceFromMid = Math.abs(fraction - midFraction);
    const depth = Math.round(18 + (1 - distanceFromMid / (halfSpan || 1)) * 12);
    return {
      phase: TWILIGHT_PHASES.night,
      sunAltitudeLabel: `${depth}° below horizon`,
    };
  }

  const bands = getTwilightBands(boundaries).filter(band => band.phase !== 'night');
  const band =
    bands.find(
      candidate => fraction >= candidate.startFraction && fraction <= candidate.endFraction
    ) ?? bands[0];

  if (!band) {
    return { phase: TWILIGHT_PHASES.civil, sunAltitudeLabel: '0° below horizon' };
  }

  const phase = TWILIGHT_PHASES[band.phase];
  const span = band.endFraction - band.startFraction;
  const rawProgress = span > 0 ? (fraction - band.startFraction) / span : 0;
  const progress = band.reverse ? 1 - rawProgress : rawProgress;

  return {
    phase,
    sunAltitudeLabel: `${Math.round(phase.altBase + progress * 6)}° below horizon`,
  };
}

/** Label for the darkest window a night actually reaches. */
export function getTwilightWindowLabel(mode: NightInfo['observingWindowMode']): string {
  switch (mode) {
    case 'nautical':
      return 'Astronomical twilight window';
    case 'civil':
      return 'Nautical twilight window';
    case 'sunset':
      return 'Civil twilight window';
    default:
      return 'No usable twilight window';
  }
}
