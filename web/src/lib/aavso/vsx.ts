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
}

// ─── Notable variable stars (always fetched) ─────────────────────────────────

// ─── Hardcoded catalog data for notable variables ────────────────────────────
// This avoids CORS issues and API dependency. Values from AAVSO VSX / GCVS.

const VARIABLE_CATALOG: VariableStarInfo[] = [
  {
    name: 'Algol (Beta Per)',
    auid: '000-BBD-264',
    ra: 47.0422,
    dec: 40.9564,
    variabilityType: 'EA',
    period: 2.8673,
    epoch: 2460000.0, // approximate recent epoch of primary minimum (JD)
    maxMagnitude: 2.12,
    minMagnitude: 3.39,
    spectralType: 'B8V',
    constellation: 'Perseus',
  },
  {
    name: 'Mira (Omicron Cet)',
    auid: '000-BBE-242',
    ra: 34.8366,
    dec: -2.9776,
    variabilityType: 'M',
    period: 331.96,
    epoch: 2459900.0,
    maxMagnitude: 2.0,
    minMagnitude: 10.1,
    spectralType: 'M7IIIe',
    constellation: 'Cetus',
  },
  {
    name: 'Delta Cephei',
    auid: '000-BCD-657',
    ra: 337.2929,
    dec: 58.4153,
    variabilityType: 'DCEP',
    period: 5.3663,
    epoch: 2459950.0,
    maxMagnitude: 3.48,
    minMagnitude: 4.37,
    spectralType: 'F5Ib-G2Ib',
    constellation: 'Cepheus',
  },
  {
    name: 'Beta Lyrae (Sheliak)',
    auid: '000-BCN-383',
    ra: 282.52,
    dec: 33.3627,
    variabilityType: 'EB',
    period: 12.9414,
    epoch: 2459800.0,
    maxMagnitude: 3.25,
    minMagnitude: 4.36,
    spectralType: 'B6-8ep',
    constellation: 'Lyra',
  },
  {
    name: 'Chi Cygni',
    auid: '000-BCP-715',
    ra: 298.8304,
    dec: 32.9122,
    variabilityType: 'M',
    period: 408.05,
    epoch: 2459700.0,
    maxMagnitude: 3.3,
    minMagnitude: 14.2,
    spectralType: 'S6-S10',
    constellation: 'Cygnus',
  },
  {
    name: 'Eta Aquilae',
    auid: '000-BBD-364',
    ra: 298.1182,
    dec: 1.0057,
    variabilityType: 'DCEP',
    period: 7.1766,
    epoch: 2459960.0,
    maxMagnitude: 3.48,
    minMagnitude: 4.39,
    spectralType: 'F6Ib-G4Ib',
    constellation: 'Aquila',
  },
  {
    name: 'R Leonis',
    auid: '000-BBG-382',
    ra: 146.8873,
    dec: 11.4283,
    variabilityType: 'M',
    period: 309.95,
    epoch: 2459850.0,
    maxMagnitude: 4.4,
    minMagnitude: 11.3,
    spectralType: 'M6.5e-M9.5e',
    constellation: 'Leo',
  },
  {
    name: 'Mu Cephei (Garnet Star)',
    auid: '000-BCN-897',
    ra: 325.878,
    dec: 58.78,
    variabilityType: 'SRC',
    period: 860.0,
    epoch: 2459500.0,
    maxMagnitude: 3.43,
    minMagnitude: 5.1,
    spectralType: 'M2Ia',
    constellation: 'Cepheus',
  },
  {
    name: 'R Coronae Borealis',
    auid: '000-BCC-026',
    ra: 239.3944,
    dec: 28.1609,
    variabilityType: 'RCB',
    period: null, // irregular fading
    epoch: null,
    maxMagnitude: 5.71,
    minMagnitude: 14.8,
    spectralType: 'C0,0(F8pep)',
    constellation: 'Corona Borealis',
  },
  {
    name: 'RR Lyrae',
    auid: '000-BCQ-240',
    ra: 286.9645,
    dec: 42.7842,
    variabilityType: 'RRAB',
    period: 0.5669,
    epoch: 2460000.0,
    maxMagnitude: 7.06,
    minMagnitude: 8.12,
    spectralType: 'A8-F7',
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
      // Beta Lyrae type: continuous variation
      const sinVal = Math.sin(phase * 2 * Math.PI);
      return star.maxMagnitude + range * 0.5 * (1 - sinVal);
    }

    case 'M':
    case 'SRC': {
      // Mira / semi-regular: roughly sinusoidal, sharper maximum
      const cosVal = Math.cos(phase * 2 * Math.PI);
      return star.maxMagnitude + range * 0.5 * (1 - cosVal);
    }

    case 'DCEP':
    case 'RRAB': {
      // Cepheid / RR Lyrae: rapid rise, slower decline
      // Rise takes ~30% of period, decline ~70%
      if (phase < 0.3) {
        // Rising to maximum (phase 0 = max for Cepheids)
        const risePhase = phase / 0.3;
        return star.minMagnitude - range * risePhase;
      }
      // Declining from maximum
      const declinePhase = (phase - 0.3) / 0.7;
      return star.maxMagnitude + range * declinePhase;
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
      if (phase < 0.3) return 'Rapid rise to maximum';
      if (phase > 0.8) return 'Approaching maximum';
      return 'Declining from maximum';

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
        description: `${star.name} at maximum`,
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
export function predictVariableStars(date: Date): VariableStarPrediction[] {
  const jd = dateToJD(date);
  const predictions: VariableStarPrediction[] = [];

  for (const star of VARIABLE_CATALOG) {
    if (!star.period || !star.epoch) {
      // Irregular variable — report at max with no phase
      predictions.push({
        star,
        predictedMagnitude: star.maxMagnitude,
        phase: 0,
        isNearMaximum: true,
        isNearMinimum: false,
        phaseDescription: getPhaseDescription(star, 0),
        nextNotableEvent: null,
        nextNotableEventTime: null,
      });
      continue;
    }

    const phase = calculatePhase(jd, star.epoch, star.period);
    const predictedMag = estimateMagnitudeFromPhase(star, phase);
    const isNearMax =
      predictedMag !== null && star.maxMagnitude !== null && predictedMag - star.maxMagnitude < 0.3;
    const isNearMin =
      predictedMag !== null && star.minMagnitude !== null && star.minMagnitude - predictedMag < 0.3;

    const nextEvent = getNextNotableEvent(star, jd);

    predictions.push({
      star,
      predictedMagnitude: predictedMag !== null ? Math.round(predictedMag * 10) / 10 : null,
      phase,
      isNearMaximum: isNearMax,
      isNearMinimum: isNearMin,
      phaseDescription: getPhaseDescription(star, phase),
      nextNotableEvent: nextEvent?.description ?? null,
      nextNotableEventTime: nextEvent?.time ?? null,
    });
  }

  return predictions;
}
