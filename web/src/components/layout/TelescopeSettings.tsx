import { Calculator, Focus, ScanLine } from 'lucide-react';
import { useState } from 'react';
import FOVCalculatorDialog from '@/components/telescope/FOVCalculatorDialog';
import {
  formatFOV,
  getEffectiveFOV,
  MAX_CUSTOM_FOV,
  MIN_CUSTOM_FOV,
  TELESCOPE_PRESETS,
  validateCustomFOV,
} from '@/lib/telescopes';
import type { CustomFOV, Settings, TelescopePresetId } from '@/types';

interface TelescopeSettingsProps {
  telescope: TelescopePresetId;
  customFOV: CustomFOV | null;
  onUpdate: (settings: Partial<Settings>) => void;
}

export default function TelescopeSettings({
  telescope,
  customFOV,
  onUpdate,
}: TelescopeSettingsProps) {
  const [localCustomWidth, setLocalCustomWidth] = useState<string>(
    customFOV?.width?.toString() ?? '100'
  );
  const [localCustomHeight, setLocalCustomHeight] = useState<string>(
    customFOV?.height?.toString() ?? '100'
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);

  const effectiveFOV = getEffectiveFOV(telescope, customFOV);
  const isCustom = telescope === 'custom';

  const handleTelescopeChange = (newTelescope: TelescopePresetId) => {
    onUpdate({ telescope: newTelescope });
    setValidationError(null);
  };

  const handleCustomFOVChange = (widthStr: string, heightStr: string) => {
    setLocalCustomWidth(widthStr);
    setLocalCustomHeight(heightStr);

    const width = parseFloat(widthStr);
    const height = parseFloat(heightStr);

    if (Number.isNaN(width) || Number.isNaN(height)) {
      setValidationError('Please enter valid numbers');
      return;
    }

    const validation = validateCustomFOV(width, height);
    if (!validation.valid) {
      setValidationError(validation.error ?? null);
      return;
    }

    setValidationError(null);
    onUpdate({ customFOV: { width, height } });
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 font-medium text-gray-300 text-sm">
        <Focus className="h-4 w-4" />
        <span>Telescope</span>
      </div>

      {/* Telescope Dropdown */}
      <select
        value={telescope}
        onChange={e => handleTelescopeChange(e.target.value as TelescopePresetId)}
        className="w-full rounded-lg border border-night-700 bg-night-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
      >
        {TELESCOPE_PRESETS.map(preset => (
          <option key={preset.id} value={preset.id}>
            {preset.name}
            {preset.id !== 'custom' && ` (${formatFOV(preset.fovWidth, preset.fovHeight)})`}
          </option>
        ))}
      </select>

      {/* Custom FOV Inputs */}
      {isCustom && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-400 text-xs">
              <ScanLine className="h-3 w-3" />
              <span>Custom Field of View (arcminutes)</span>
            </div>
            <button
              type="button"
              onClick={() => setShowCalculator(true)}
              className="flex items-center gap-1 text-sky-400 text-xs transition-colors hover:text-sky-300"
            >
              <Calculator className="h-3 w-3" />
              Calculate from equipment
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="custom-fov-width" className="mb-1 block text-gray-500 text-xs">
                Width
              </label>
              <input
                id="custom-fov-width"
                type="number"
                min={MIN_CUSTOM_FOV}
                max={MAX_CUSTOM_FOV}
                value={localCustomWidth}
                onChange={e => handleCustomFOVChange(e.target.value, localCustomHeight)}
                className="w-full rounded-lg border border-night-700 bg-night-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label htmlFor="custom-fov-height" className="mb-1 block text-gray-500 text-xs">
                Height
              </label>
              <input
                id="custom-fov-height"
                type="number"
                min={MIN_CUSTOM_FOV}
                max={MAX_CUSTOM_FOV}
                value={localCustomHeight}
                onChange={e => handleCustomFOVChange(localCustomWidth, e.target.value)}
                className="w-full rounded-lg border border-night-700 bg-night-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>
          {validationError && <p className="text-red-400 text-xs">{validationError}</p>}
          <p className="text-gray-500 text-xs">
            Range: {MIN_CUSTOM_FOV} - {MAX_CUSTOM_FOV} arcminutes (up to{' '}
            {(MAX_CUSTOM_FOV / 60).toFixed(0)}°)
          </p>
        </div>
      )}

      {/* Current FOV Display */}
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-gray-500">Current FOV:</span>
        <span className="font-medium text-sky-400">
          {formatFOV(effectiveFOV.width, effectiveFOV.height)}
        </span>
      </div>

      <FOVCalculatorDialog
        isOpen={showCalculator}
        onClose={() => setShowCalculator(false)}
        onApply={fov => {
          const w = fov.width.toString();
          const h = fov.height.toString();
          setLocalCustomWidth(w);
          setLocalCustomHeight(h);
          handleCustomFOVChange(w, h);
        }}
      />
    </div>
  );
}
