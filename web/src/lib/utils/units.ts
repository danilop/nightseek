/**
 * Centralized unit conversion and formatting utilities
 * All conversions happen at display time - data is stored in metric
 */

export type TemperatureUnit = 'celsius' | 'fahrenheit';
export type SpeedUnit = 'kmh' | 'mph';
export type PressureUnit = 'hpa' | 'inhg';
export type DistanceUnit = 'km' | 'mi';

export interface UnitPreferences {
  temperature: TemperatureUnit;
  speed: SpeedUnit;
  pressure: PressureUnit;
  distance: DistanceUnit;
}

export const DEFAULT_UNIT_PREFERENCES: UnitPreferences = {
  temperature: 'celsius',
  speed: 'kmh',
  pressure: 'hpa',
  distance: 'km',
};

// Conversion functions (pure, no formatting)
export function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9) / 5 + 32;
}

export function kmhToMph(kmh: number): number {
  return kmh * 0.621371;
}

export function hpaToInhg(hpa: number): number {
  return hpa * 0.02953;
}

export function kmToMiles(km: number): number {
  return km * 0.621371;
}

// Formatting functions with unit labels
export function formatTemperature(
  celsius: number | null,
  unit: TemperatureUnit,
  options: { showUnit?: boolean; decimals?: number } = {}
): string {
  const { showUnit = true, decimals = 0 } = options;
  if (celsius === null) return '—';

  if (unit === 'fahrenheit') {
    const value = celsiusToFahrenheit(celsius);
    return showUnit ? `${value.toFixed(decimals)}°F` : `${value.toFixed(decimals)}°`;
  }
  return showUnit ? `${celsius.toFixed(decimals)}°C` : `${celsius.toFixed(decimals)}°`;
}

export function formatTemperatureValue(celsius: number | null, unit: TemperatureUnit): string {
  if (celsius === null) return '—';
  const value = unit === 'fahrenheit' ? celsiusToFahrenheit(celsius) : celsius;
  return `${Math.round(value)}°`;
}

export function formatTemperatureDelta(
  celsiusDelta: number | null,
  unit: TemperatureUnit,
  options: { decimals?: number } = {}
): string {
  const { decimals = 1 } = options;
  if (celsiusDelta === null) return '—';

  // For deltas, the conversion factor is just 9/5 (no +32)
  const value = unit === 'fahrenheit' ? (celsiusDelta * 9) / 5 : celsiusDelta;
  const unitLabel = unit === 'fahrenheit' ? '°F' : '°C';
  return `${value.toFixed(decimals)}${unitLabel}`;
}

export function formatSpeed(
  kmh: number | null,
  unit: SpeedUnit,
  options: { showUnit?: boolean; decimals?: number } = {}
): string {
  const { showUnit = true, decimals = 0 } = options;
  if (kmh === null) return '—';

  if (unit === 'mph') {
    const value = kmhToMph(kmh);
    return showUnit ? `${value.toFixed(decimals)} mph` : value.toFixed(decimals);
  }
  return showUnit ? `${kmh.toFixed(decimals)} km/h` : kmh.toFixed(decimals);
}

export function formatPressure(
  hpa: number | null,
  unit: PressureUnit,
  options: { showUnit?: boolean; decimals?: number } = {}
): string {
  if (hpa === null) return '—';
  const { showUnit = true } = options;
  const decimals = options.decimals ?? (unit === 'inhg' ? 2 : 0);

  if (unit === 'inhg') {
    const value = hpaToInhg(hpa);
    return showUnit ? `${value.toFixed(decimals)} inHg` : value.toFixed(decimals);
  }
  return showUnit ? `${hpa.toFixed(decimals)} hPa` : hpa.toFixed(decimals);
}

export function formatDistance(
  km: number | null,
  unit: DistanceUnit,
  options: { showUnit?: boolean; decimals?: number; useLocale?: boolean } = {}
): string {
  const { showUnit = true, decimals = 0, useLocale = true } = options;
  if (km === null) return '—';

  if (unit === 'mi') {
    const value = kmToMiles(km);
    const formatted = useLocale
      ? value.toLocaleString(undefined, { maximumFractionDigits: decimals })
      : value.toFixed(decimals);
    return showUnit ? `${formatted} mi` : formatted;
  }
  const formatted = useLocale
    ? km.toLocaleString(undefined, { maximumFractionDigits: decimals })
    : km.toFixed(decimals);
  return showUnit ? `${formatted} km` : formatted;
}

// Unit labels for tooltips and explanations
export function getTemperatureUnitLabel(unit: TemperatureUnit): string {
  return unit === 'fahrenheit' ? '°F' : '°C';
}

export function getSpeedUnitLabel(unit: SpeedUnit): string {
  return unit === 'mph' ? 'mph' : 'km/h';
}

export function getPressureUnitLabel(unit: PressureUnit): string {
  return unit === 'inhg' ? 'inHg' : 'hPa';
}

export function getDistanceUnitLabel(unit: DistanceUnit): string {
  return unit === 'mi' ? 'miles' : 'km';
}
