import { describe, expect, it } from 'vitest';
import { calculateFOV, validateFOVCalculatorInput } from './fov-calculator';

describe('calculateFOV', () => {
  it('computes correct FOV for Dwarf II specs', () => {
    const result = calculateFOV({
      focalLengthMm: 100,
      pixelSizeUm: 1.4,
      sensorResolutionWidth: 3840,
      sensorResolutionHeight: 2160,
    });
    // Dwarf II preset is 180' x 100', should be close
    expect(result.fovWidthArcmin).toBeCloseTo(184.61, 0);
    expect(result.fovHeightArcmin).toBeCloseTo(103.86, 0);
    expect(result.fovWidthDeg).toBeGreaterThan(2.5);
    expect(result.fovHeightDeg).toBeGreaterThan(1.5);
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
