import { describe, expect, it } from 'vitest';
import { calculateFOV, validateFOVCalculatorInput } from './fov-calculator';

// Baseline tests against known telescope presets.
// Specs sourced from manufacturer datasheets; expected FOV from presets.ts.
// Tolerance ±5' accounts for optical vignetting / slight focal length variance.
const TELESCOPE_BASELINES = [
  {
    name: 'Dwarf Mini',
    input: {
      focalLengthMm: 150,
      pixelSizeUm: 2.9,
      sensorResolutionWidth: 1920,
      sensorResolutionHeight: 1080,
    },
    expectedWidth: 128,
    expectedHeight: 72,
  },
  {
    name: 'Dwarf 3',
    input: {
      focalLengthMm: 150,
      pixelSizeUm: 2.0,
      sensorResolutionWidth: 3856,
      sensorResolutionHeight: 2180,
    },
    expectedWidth: 174,
    expectedHeight: 99,
  },
  {
    name: 'Seestar S50 (portrait)',
    input: {
      focalLengthMm: 250,
      pixelSizeUm: 2.9,
      sensorResolutionWidth: 1080,
      sensorResolutionHeight: 1920,
    },
    expectedWidth: 42,
    expectedHeight: 78,
  },
  {
    name: 'Celestron Origin',
    input: {
      focalLengthMm: 335,
      pixelSizeUm: 2.4,
      sensorResolutionWidth: 3096,
      sensorResolutionHeight: 2080,
    },
    expectedWidth: 76,
    expectedHeight: 51,
  },
  {
    name: 'Vaonis Stellina',
    input: {
      focalLengthMm: 400,
      pixelSizeUm: 2.4,
      sensorResolutionWidth: 3096,
      sensorResolutionHeight: 2080,
    },
    expectedWidth: 60,
    expectedHeight: 42,
  },
] as const;

describe('calculateFOV', () => {
  describe('baseline: real telescope presets', () => {
    for (const t of TELESCOPE_BASELINES) {
      it(`matches ${t.name} preset FOV (±5')`, () => {
        const result = calculateFOV(t.input);
        expect(result.fovWidthArcmin).toBeGreaterThanOrEqual(t.expectedWidth - 5);
        expect(result.fovWidthArcmin).toBeLessThanOrEqual(t.expectedWidth + 5);
        expect(result.fovHeightArcmin).toBeGreaterThanOrEqual(t.expectedHeight - 5);
        expect(result.fovHeightArcmin).toBeLessThanOrEqual(t.expectedHeight + 5);
      });
    }
  });

  it('computes correct FOV for Dwarf II specs', () => {
    const result = calculateFOV({
      focalLengthMm: 100,
      pixelSizeUm: 1.45,
      sensorResolutionWidth: 3840,
      sensorResolutionHeight: 2160,
    });
    // Full sensor yields ~191'x108'; preset is 180'x100' due to optical cropping
    expect(result.fovWidthArcmin).toBeCloseTo(191.4, 0);
    expect(result.fovHeightArcmin).toBeCloseTo(107.7, 0);
    expect(result.imageScaleArcsecPerPx).toBeGreaterThan(0);
  });

  it('barlow 2x halves the FOV', () => {
    const base = calculateFOV({
      focalLengthMm: 100,
      pixelSizeUm: 1.4,
      sensorResolutionWidth: 3840,
      sensorResolutionHeight: 2160,
    });
    const withBarlow = calculateFOV({
      focalLengthMm: 100,
      pixelSizeUm: 1.4,
      sensorResolutionWidth: 3840,
      sensorResolutionHeight: 2160,
      barlowFactor: 2,
    });
    // Barlow 2x should roughly halve the FOV
    expect(withBarlow.fovWidthArcmin).toBeCloseTo(base.fovWidthArcmin / 2, 0);
    expect(withBarlow.fovHeightArcmin).toBeCloseTo(base.fovHeightArcmin / 2, 0);
  });

  it('reducer 0.63x increases the FOV', () => {
    const base = calculateFOV({
      focalLengthMm: 1000,
      pixelSizeUm: 5,
      sensorResolutionWidth: 4000,
      sensorResolutionHeight: 3000,
    });
    const withReducer = calculateFOV({
      focalLengthMm: 1000,
      pixelSizeUm: 5,
      sensorResolutionWidth: 4000,
      sensorResolutionHeight: 3000,
      barlowFactor: 0.63,
    });
    expect(withReducer.fovWidthArcmin).toBeGreaterThan(base.fovWidthArcmin);
    expect(withReducer.fovHeightArcmin).toBeGreaterThan(base.fovHeightArcmin);
  });

  it('computes correct image scale for 1000mm FL + 5μm pixel', () => {
    const result = calculateFOV({
      focalLengthMm: 1000,
      pixelSizeUm: 5,
      sensorResolutionWidth: 4000,
      sensorResolutionHeight: 3000,
    });
    // 206.265 * 5 / 1000 ≈ 1.03 "/px
    expect(result.imageScaleArcsecPerPx).toBeCloseTo(1.03, 1);
  });

  it('handles very small pixel size', () => {
    const result = calculateFOV({
      focalLengthMm: 500,
      pixelSizeUm: 0.5,
      sensorResolutionWidth: 8000,
      sensorResolutionHeight: 6000,
    });
    expect(result.fovWidthArcmin).toBeGreaterThan(0);
    expect(result.fovHeightArcmin).toBeGreaterThan(0);
    expect(result.imageScaleArcsecPerPx).toBeGreaterThan(0);
  });

  it('handles very large focal length', () => {
    const result = calculateFOV({
      focalLengthMm: 10000,
      pixelSizeUm: 3.75,
      sensorResolutionWidth: 4000,
      sensorResolutionHeight: 3000,
    });
    expect(result.fovWidthArcmin).toBeGreaterThan(0);
    expect(result.fovWidthArcmin).toBeLessThan(60); // should be quite narrow
    expect(result.imageScaleArcsecPerPx).toBeGreaterThan(0);
  });

  it('defaults barlowFactor to 1.0', () => {
    const withoutBarlow = calculateFOV({
      focalLengthMm: 500,
      pixelSizeUm: 3,
      sensorResolutionWidth: 4000,
      sensorResolutionHeight: 3000,
    });
    const withBarlow1 = calculateFOV({
      focalLengthMm: 500,
      pixelSizeUm: 3,
      sensorResolutionWidth: 4000,
      sensorResolutionHeight: 3000,
      barlowFactor: 1.0,
    });
    expect(withoutBarlow.fovWidthArcmin).toBe(withBarlow1.fovWidthArcmin);
    expect(withoutBarlow.fovHeightArcmin).toBe(withBarlow1.fovHeightArcmin);
  });

  it('rounds results to 2 decimal places', () => {
    const result = calculateFOV({
      focalLengthMm: 333,
      pixelSizeUm: 2.7,
      sensorResolutionWidth: 3333,
      sensorResolutionHeight: 2222,
    });
    // Check that values have at most 2 decimal places
    for (const value of [
      result.fovWidthArcmin,
      result.fovHeightArcmin,
      result.fovWidthDeg,
      result.fovHeightDeg,
      result.imageScaleArcsecPerPx,
    ]) {
      const decimals = value.toString().split('.')[1]?.length ?? 0;
      expect(decimals).toBeLessThanOrEqual(2);
    }
  });
});

describe('validateFOVCalculatorInput', () => {
  it('returns valid for correct input', () => {
    expect(
      validateFOVCalculatorInput({
        focalLengthMm: 100,
        pixelSizeUm: 1.4,
        sensorResolutionWidth: 3840,
        sensorResolutionHeight: 2160,
        barlowFactor: 1.0,
      })
    ).toEqual({ valid: true });
  });

  it('rejects zero focal length', () => {
    const result = validateFOVCalculatorInput({ focalLengthMm: 0 });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Focal length');
  });

  it('rejects negative focal length', () => {
    const result = validateFOVCalculatorInput({ focalLengthMm: -100 });
    expect(result.valid).toBe(false);
  });

  it('rejects zero pixel size', () => {
    const result = validateFOVCalculatorInput({ pixelSizeUm: 0 });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Pixel size');
  });

  it('rejects negative pixel size', () => {
    const result = validateFOVCalculatorInput({ pixelSizeUm: -1 });
    expect(result.valid).toBe(false);
  });

  it('rejects zero sensor width', () => {
    const result = validateFOVCalculatorInput({ sensorResolutionWidth: 0 });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Sensor width');
  });

  it('rejects zero sensor height', () => {
    const result = validateFOVCalculatorInput({ sensorResolutionHeight: 0 });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Sensor height');
  });

  it('rejects zero barlow factor', () => {
    const result = validateFOVCalculatorInput({ barlowFactor: 0 });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Barlow');
  });

  it('rejects negative barlow factor', () => {
    const result = validateFOVCalculatorInput({ barlowFactor: -0.5 });
    expect(result.valid).toBe(false);
  });

  it('accepts valid partial input', () => {
    expect(validateFOVCalculatorInput({ focalLengthMm: 100 })).toEqual({ valid: true });
    expect(validateFOVCalculatorInput({ pixelSizeUm: 3 })).toEqual({ valid: true });
    expect(validateFOVCalculatorInput({})).toEqual({ valid: true });
  });
});
