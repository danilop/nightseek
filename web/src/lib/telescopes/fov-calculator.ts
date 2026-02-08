export interface FOVCalculatorInput {
  focalLengthMm: number;
  pixelSizeUm: number;
  sensorResolutionWidth: number;
  sensorResolutionHeight: number;
  barlowFactor?: number;
}

export interface FOVCalculatorResult {
  fovWidthArcmin: number;
  fovHeightArcmin: number;
  fovWidthDeg: number;
  fovHeightDeg: number;
  imageScaleArcsecPerPx: number;
}

/**
 * Calculate FOV from equipment specs using the astronomy.tools arctangent method.
 */
export function calculateFOV(input: FOVCalculatorInput): FOVCalculatorResult {
  const barlow = input.barlowFactor ?? 1.0;
  const effectiveFocalLength = input.focalLengthMm * barlow;
  const pixelSizeMm = input.pixelSizeUm / 1000;

  const sensorWidthMm = pixelSizeMm * input.sensorResolutionWidth;
  const sensorHeightMm = pixelSizeMm * input.sensorResolutionHeight;

  const fovWidthDeg = 2 * Math.atan(sensorWidthMm / (2 * effectiveFocalLength)) * (180 / Math.PI);
  const fovHeightDeg = 2 * Math.atan(sensorHeightMm / (2 * effectiveFocalLength)) * (180 / Math.PI);

  const imageScaleArcsecPerPx =
    (2 * Math.atan(pixelSizeMm / (2 * effectiveFocalLength)) * 180 * 3600) / Math.PI;

  return {
    fovWidthArcmin: round2(fovWidthDeg * 60),
    fovHeightArcmin: round2(fovHeightDeg * 60),
    fovWidthDeg: round2(fovWidthDeg),
    fovHeightDeg: round2(fovHeightDeg),
    imageScaleArcsecPerPx: round2(imageScaleArcsecPerPx),
  };
}

/**
 * Validate partial FOV calculator input, returning an error message if invalid.
 */
export function validateFOVCalculatorInput(input: Partial<FOVCalculatorInput>): {
  valid: boolean;
  error?: string;
} {
  if (input.focalLengthMm !== undefined && input.focalLengthMm <= 0) {
    return { valid: false, error: 'Focal length must be greater than 0' };
  }
  if (input.pixelSizeUm !== undefined && input.pixelSizeUm <= 0) {
    return { valid: false, error: 'Pixel size must be greater than 0' };
  }
  if (input.sensorResolutionWidth !== undefined && input.sensorResolutionWidth <= 0) {
    return { valid: false, error: 'Sensor width must be greater than 0' };
  }
  if (input.sensorResolutionHeight !== undefined && input.sensorResolutionHeight <= 0) {
    return { valid: false, error: 'Sensor height must be greater than 0' };
  }
  if (input.barlowFactor !== undefined && input.barlowFactor <= 0) {
    return { valid: false, error: 'Barlow/reducer factor must be greater than 0' };
  }
  return { valid: true };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
