/**
 * AAVSO VSX (Variable Star Index) integration.
 * https://www.aavso.org/vsx/
 *
 * Provides variable star catalog data: type, period, magnitude range, epoch.
 * Used to predict brightness for notable variable stars on any given night.
 *
 * No API key required. Cached aggressively (7 days) since catalog data is stable.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VariableStarInfo {
  name: string;
  auid: string;
  ra: number; // degrees
  dec: number; // degrees
  variabilityType: string; // e.g., "EA", "M", "DCEP", "RR"
  period: number | null; // days
  epoch: number | null; // JD of maximum or primary minimum
  maxMagnitude: number | null;
  minMagnitude: number | null;
  spectralType: string;
  constellation: string;
}

export interface VariableStarPrediction {
  star: VariableStarInfo;
  predictedMagnitude: number | null;
  phase: number; // 0-1, where 0 = epoch reference point
  isNearMaximum: boolean;
  isNearMinimum: boolean;
  phaseDescription: string;
  nextNotableEvent: string | null;
  nextNotableEventTime: Date | null;
  predictionQuality: 'ephemeris' | 'approximate' | 'unpredictable';
}

// ─── Notable variable stars (always fetched) ─────────────────────────────────

// ─── Hardcoded catalog data for notable variables ────────────────────────────
// This avoids CORS issues and API dependency. Values from AAVSO VSX / GCVS.

const VARIABLE_CATALOG: VariableStarInfo[] = [
  {
    name: 'Algol (Beta Per)',
    auid: '000-BBF-713',
    ra: 47.04221,
    dec: 40.95567,
    variabilityType: 'EA',
    period: 2.867343,
    epoch: 2457675.72,
    maxMagnitude: 2.09,
    minMagnitude: 3.3,
    spectralType: 'B8V+G8III',
    constellation: 'Perseus',
  },
  {
    name: 'Mira (Omicron Cet)',
    auid: '000-BBD-706',
    ra: 34.83662,
    dec: -2.97764,
    variabilityType: 'M',
    period: 331.3,
    epoch: 2458457,
    maxMagnitude: 2.0,
    minMagnitude: 10.1,
    spectralType: 'M5e-M9e',
    constellation: 'Cetus',
  },
  {
    name: 'Delta Cephei',
    auid: '000-BCQ-471',
    ra: 337.29279,
    dec: 58.41519,
    variabilityType: 'DCEP',
    period: 5.36629,
    epoch: 2436075.415,
    maxMagnitude: 3.49,
    minMagnitude: 4.36,
    spectralType: 'F5Ib-G1Ib',
    constellation: 'Cepheus',
  },
  {
    name: 'Beta Lyrae (Sheliak)',
    auid: '000-BCD-386',
    ra: 282.51996,
    dec: 33.36267,
    variabilityType: 'EB',
    period: 12.944,
    epoch: 2459097.95,
    maxMagnitude: 3.3,
    minMagnitude: 4.35,
    spectralType: 'B8II-IIIep',
    constellation: 'Lyra',
  },
  {
    name: 'Chi Cygni',
    auid: '000-BCJ-205',
    ra: 297.64133,
    dec: 32.91406,
    variabilityType: 'M',
    period: 408.05,
    epoch: 2442140,
    maxMagnitude: 3.3,
    minMagnitude: 14.2,
    spectralType: 'S6,2e-S10,4e(MSe)',
    constellation: 'Cygnus',
  },
  {
    name: 'Eta Aquilae',
    auid: '000-BCT-763',
    ra: 298.11821,
    dec: 1.00567,
    variabilityType: 'DCEP',
    period: 7.17679,
    epoch: 2436084.656,
    maxMagnitude: 3.49,
    minMagnitude: 4.3,
    spectralType: 'F6Ib-G4Ib',
    constellation: 'Aquila',
  },
  {
    name: 'R Leonis',
    auid: '000-BBQ-798',
    ra: 146.88954,
    dec: 11.42881,
    variabilityType: 'M',
    period: 312.2,
    epoch: 2444164,
    maxMagnitude: 4.4,
    minMagnitude: 11,
    spectralType: 'M6e-M8IIIe-M9.5e',
    constellation: 'Leo',
  },
  {
    name: 'Mu Cephei (Garnet Star)',
    auid: '000-BCP-244',
    ra: 325.87692,
    dec: 58.78003,
    variabilityType: 'SRC',
    period: 835,
    epoch: 2449518,
    maxMagnitude: 3.43,
    minMagnitude: 5.1,
    spectralType: 'M2Iae',
    constellation: 'Cepheus',
  },
  {
    name: 'R Coronae Borealis',
    auid: '000-BBW-575',
    ra: 237.14342,
    dec: 28.15675,
    variabilityType: 'RCB',
    period: null, // irregular fading
    epoch: null,
    maxMagnitude: 5.61,
    minMagnitude: 15.1,
    spectralType: 'C0,0(F8pep)',
    constellation: 'Corona Borealis',
  },
  {
    name: 'RR Lyrae',
    auid: '000-BCG-719',
    ra: 291.36629,
    dec: 42.78436,
    variabilityType: 'RRAB',
    period: 0.566775,
    epoch: 2459422.522,
    maxMagnitude: 7.17,
    minMagnitude: 8.14,
    spectralType: 'A5.0-F7.0',
    constellation: 'Lyra',
  },
];

// ─── Phase & Prediction ──────────────────────────────────────────────────────

/**
 * Convert a JS Date to Julian Date.
 */
function dateToJD(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

/**
 * Calculate the phase of a variable star at a given time.
 * Returns 0-1 where 0 = epoch reference point (max for pulsating, min for eclipsing).
 */
function calculatePhase(jd: number, epoch: number, period: number): number {
  const elapsed = jd - epoch;
  const phase = (elapsed / period) % 1;
  return phase < 0 ? phase + 1 : phase;
}

/**
 * Estimate magnitude from phase using a simplified light curve model.
 */
function estimateMagnitudeFromPhase(star: VariableStarInfo, phase: number): number | null {
  if (star.maxMagnitude === null || star.minMagnitude === null) return null;

  const range = star.minMagnitude - star.maxMagnitude;

  switch (star.variabilityType) {
    case 'EA': {
      // Eclipsing Algol-type: flat at max except near phase 0 (primary minimum)
      // and ~0.5 (secondary minimum, shallower)
      if (phase < 0.05 || phase > 0.95) {
        // Primary eclipse
        const eclipsePhase = phase < 0.5 ? phase : 1 - phase;
        return star.maxMagnitude + range * (1 - eclipsePhase / 0.05);
      }
      if (phase > 0.45 && phase < 0.55) {
        // Secondary eclipse (half depth)
        const eclipsePhase = Math.abs(phase - 0.5);
        return star.maxMagnitude + range * 0.5 * (1 - eclipsePhase / 0.05);
      }
      return star.maxMagnitude;
    }

    case 'EB': {
      // Beta Lyrae type: primary minimum at phase 0, secondary at phase 0.5.
      const primaryDistance = Math.min(phase, 1 - phase);
      const primaryDepth = Math.max(0, 1 - primaryDistance / 0.25);
      const secondaryDepth = 0.5 * Math.max(0, 1 - Math.abs(phase - 0.5) / 0.25);
      return star.maxMagnitude + range * Math.max(primaryDepth, secondaryDepth);
    }

    case 'M':
    case 'SRC': {
      // Mira / semi-regular: roughly sinusoidal, sharper maximum
      const cosVal = Math.cos(phase * 2 * Math.PI);
      return star.maxMagnitude + range * 0.5 * (1 - cosVal);
    }

    case 'DCEP':
    case 'RRAB': {
      // Epoch phase 0 is maximum: slow decline, then rapid rise.
      if (phase < 0.7) {
        return star.maxMagnitude + range * (phase / 0.7);
      }
      return star.minMagnitude - range * ((phase - 0.7) / 0.3);
    }

    case 'RCB': {
      // R CrB type: usually at max, unpredictable fades
      // We can only report "at maximum" since fades are irregular
      return star.maxMagnitude;
    }

    default: {
      // Generic sinusoidal approximation
      const cosDefault = Math.cos(phase * 2 * Math.PI);
      return star.maxMagnitude + range * 0.5 * (1 - cosDefault);
    }
  }
}

/**
 * Get phase description for display.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: variability classes need explicit phase buckets for readable descriptions
function getPhaseDescription(star: VariableStarInfo, phase: number): string {
  switch (star.variabilityType) {
    case 'EA':
      if (phase < 0.03 || phase > 0.97) return 'At primary minimum (eclipse)';
      if (phase > 0.47 && phase < 0.53) return 'At secondary minimum';
      return 'At normal brightness';

    case 'EB':
      if (phase < 0.05 || phase > 0.95) return 'Near primary minimum';
      if (phase > 0.45 && phase < 0.55) return 'Near secondary minimum';
      if (phase > 0.2 && phase < 0.3) return 'Near maximum brightness';
      return 'Varying continuously';

    case 'M':
    case 'SRC':
      if (phase < 0.1 || phase > 0.9) return 'Near maximum brightness';
      if (phase > 0.4 && phase < 0.6) return 'Near minimum brightness';
      if (phase < 0.5) return 'Fading toward minimum';
      return 'Brightening toward maximum';

    case 'DCEP':
    case 'RRAB':
      if (phase < 0.05) return 'At maximum brightness';
      if (phase < 0.7) return 'Fading from maximum';
      return 'Brightening rapidly toward maximum';

    case 'RCB':
      return 'At normal maximum (fades are unpredictable)';

    default:
      if (phase < 0.1 || phase > 0.9) return 'Near maximum brightness';
      if (phase > 0.4 && phase < 0.6) return 'Near minimum brightness';
      return 'Mid-cycle';
  }
}

/**
 * Calculate next notable event (minimum for eclipsing, maximum for pulsating).
 */
function getNextNotableEvent(
  star: VariableStarInfo,
  jd: number
): { description: string; time: Date } | null {
  if (!star.period || !star.epoch) return null;

  const phase = calculatePhase(jd, star.epoch, star.period);

  switch (star.variabilityType) {
    case 'EA':
    case 'EB': {
      // Next primary minimum
      const phasesToMin = phase > 0 ? 1 - phase : -phase;
      const jdNextMin = jd + phasesToMin * star.period;
      return {
        description: `${star.name} at minimum`,
        time: new Date((jdNextMin - 2440587.5) * 86400000),
      };
    }

    case 'M':
    case 'DCEP':
    case 'RRAB':
    case 'SRC': {
      // Next maximum
      const phasesToMax = phase > 0 ? 1 - phase : -phase;
      const jdNextMax = jd + phasesToMax * star.period;
      return {
        description:
          star.variabilityType === 'M' || star.variabilityType === 'SRC'
            ? `${star.name} approximate maximum`
            : `${star.name} at maximum`,
        time: new Date((jdNextMax - 2440587.5) * 86400000),
      };
    }

    default:
      return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Predict brightness and phase for notable variable stars on a given date.
 * Pure computation — no network calls needed.
 */
function predictVariableStar(star: VariableStarInfo, jd: number): VariableStarPrediction {
  if (!star.period || !star.epoch) {
    return {
      star,
      predictedMagnitude: null,
      phase: 0,
      isNearMaximum: false,
      isNearMinimum: false,
      phaseDescription: 'Brightness is unpredictable — check current observations',
      nextNotableEvent: null,
      nextNotableEventTime: null,
      predictionQuality: 'unpredictable',
    };
  }

  const phase = calculatePhase(jd, star.epoch, star.period);
  const hasApproximateLongCycle = star.variabilityType === 'M' || star.variabilityType === 'SRC';
  const modelMagnitude = estimateMagnitudeFromPhase(star, phase);
  const predictedMagnitude = hasApproximateLongCycle ? null : modelMagnitude;
  const isNearMaximum = hasApproximateLongCycle
    ? phase < 0.1 || phase > 0.9
    : predictedMagnitude !== null &&
      star.maxMagnitude !== null &&
      predictedMagnitude - star.maxMagnitude < 0.3;
  const isNearMinimum = hasApproximateLongCycle
    ? phase > 0.4 && phase < 0.6
    : predictedMagnitude !== null &&
      star.minMagnitude !== null &&
      star.minMagnitude - predictedMagnitude < 0.3;
  const nextEvent = getNextNotableEvent(star, jd);

  return {
    star,
    predictedMagnitude:
      predictedMagnitude !== null ? Math.round(predictedMagnitude * 10) / 10 : null,
    phase,
    isNearMaximum,
    isNearMinimum,
    phaseDescription: getPhaseDescription(star, phase),
    nextNotableEvent: nextEvent?.description ?? null,
    nextNotableEventTime: nextEvent?.time ?? null,
    predictionQuality:
      star.variabilityType === 'EA' || star.variabilityType === 'EB' ? 'ephemeris' : 'approximate',
  };
}

export function predictVariableStars(date: Date): VariableStarPrediction[] {
  const jd = dateToJD(date);
  return VARIABLE_CATALOG.map(star => predictVariableStar(star, jd));
}
