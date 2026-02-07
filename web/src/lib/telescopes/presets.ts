import type { TelescopePreset, TelescopePresetId } from '@/types';

/**
 * Predefined telescope FOV presets for popular smart telescopes
 * FOV values in arcminutes
 */
export const TELESCOPE_PRESETS: TelescopePreset[] = [
  { id: 'dwarf_mini', name: 'Dwarf Mini', fovWidth: 128, fovHeight: 72 },
  { id: 'dwarf_ii', name: 'Dwarf II', fovWidth: 180, fovHeight: 100 },
  { id: 'dwarf_3', name: 'Dwarf 3', fovWidth: 174, fovHeight: 99 },
  { id: 'seestar_s30', name: 'Seestar S30', fovWidth: 72, fovHeight: 128 },
  { id: 'seestar_s30_pro', name: 'Seestar S30 Pro', fovWidth: 134, fovHeight: 240 },
  { id: 'seestar_s50', name: 'Seestar S50', fovWidth: 42, fovHeight: 78 },
  { id: 'unistellar_evscope', name: 'Unistellar eVscope/eQuinox', fovWidth: 27, fovHeight: 37 },
  {
    id: 'unistellar_evscope2',
    name: 'Unistellar eVscope 2/eQuinox 2',
    fovWidth: 34,
    fovHeight: 46,
  },
  { id: 'unistellar_odyssey', name: 'Unistellar Odyssey', fovWidth: 34, fovHeight: 45 },
  { id: 'vaonis_stellina', name: 'Vaonis Stellina', fovWidth: 60, fovHeight: 42 },
  { id: 'vaonis_vespera_ii', name: 'Vaonis Vespera II', fovWidth: 150, fovHeight: 84 },
  { id: 'vaonis_vespera_pro', name: 'Vaonis Vespera Pro', fovWidth: 96, fovHeight: 96 },
  { id: 'celestron_origin', name: 'Celestron Origin', fovWidth: 76, fovHeight: 51 },
  { id: 'custom', name: 'Custom', fovWidth: 0, fovHeight: 0 },
];

const DEFAULT_TELESCOPE: TelescopePresetId = 'dwarf_mini';
export const MAX_CUSTOM_FOV = 480; // 8 degrees = 2x largest preset
export const MIN_CUSTOM_FOV = 1;

/**
 * Get telescope preset by ID
 */
function getTelescopePreset(id: TelescopePresetId): TelescopePreset | undefined {
  return TELESCOPE_PRESETS.find(p => p.id === id);
}

/**
 * Get effective FOV for a telescope setting, accounting for custom FOV
 */
export function getEffectiveFOV(
  telescopeId: TelescopePresetId,
  customFOV: { width: number; height: number } | null
): { width: number; height: number } {
  if (telescopeId === 'custom' && customFOV) {
    return {
      width: Math.max(MIN_CUSTOM_FOV, Math.min(MAX_CUSTOM_FOV, customFOV.width)),
      height: Math.max(MIN_CUSTOM_FOV, Math.min(MAX_CUSTOM_FOV, customFOV.height)),
    };
  }

  const preset = getTelescopePreset(telescopeId);
  if (preset) {
    return { width: preset.fovWidth, height: preset.fovHeight };
  }

  // Fallback to default telescope
  const defaultPreset = getTelescopePreset(DEFAULT_TELESCOPE);
  return { width: defaultPreset?.fovWidth ?? 128, height: defaultPreset?.fovHeight ?? 72 };
}

/**
 * Format FOV for display
 */
export function formatFOV(widthArcmin: number, heightArcmin: number): string {
  // Convert to degrees if >= 60 arcmin
  if (widthArcmin >= 60 || heightArcmin >= 60) {
    const widthDeg = widthArcmin / 60;
    const heightDeg = heightArcmin / 60;
    return `${widthDeg.toFixed(1)}° x ${heightDeg.toFixed(1)}°`;
  }
  return `${widthArcmin}' x ${heightArcmin}'`;
}

/**
 * Validate custom FOV values
 */
export function validateCustomFOV(
  width: number,
  height: number
): { valid: boolean; error?: string } {
  if (width < MIN_CUSTOM_FOV || width > MAX_CUSTOM_FOV) {
    return {
      valid: false,
      error: `Width must be between ${MIN_CUSTOM_FOV} and ${MAX_CUSTOM_FOV} arcminutes`,
    };
  }
  if (height < MIN_CUSTOM_FOV || height > MAX_CUSTOM_FOV) {
    return {
      valid: false,
      error: `Height must be between ${MIN_CUSTOM_FOV} and ${MAX_CUSTOM_FOV} arcminutes`,
    };
  }
  return { valid: true };
}
