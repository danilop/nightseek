import { useState } from 'react';
import {
  formatFOV,
  MAX_CUSTOM_FOV,
  MIN_CUSTOM_FOV,
  TELESCOPE_PRESETS,
  validateCustomFOV,
} from '@/lib/telescopes';
import { useApp } from '@/stores/AppContext';
import type { TelescopePresetId } from '@/types';

interface TelescopeSetupProps {
  onComplete: () => void;
}

export default function TelescopeSetup({ onComplete }: TelescopeSetupProps) {
  const { updateSettings } = useApp();
  const [selected, setSelected] = useState<TelescopePresetId>('dwarf_mini');
  const [customWidth, setCustomWidth] = useState('');
  const [customHeight, setCustomHeight] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleContinue = () => {
    if (selected === 'custom') {
      const w = parseFloat(customWidth);
      const h = parseFloat(customHeight);
      if (Number.isNaN(w) || Number.isNaN(h)) {
        setError('Please enter both width and height values.');
        return;
      }
      const result = validateCustomFOV(w, h);
      if (!result.valid) {
        setError(result.error ?? 'Invalid FOV values.');
        return;
      }
      updateSettings({ telescope: 'custom', customFOV: { width: w, height: h } });
    } else {
      updateSettings({ telescope: selected, customFOV: null });
    }
    onComplete();
  };

  const handleSkip = () => {
    // Keep default (dwarf_mini)
    onComplete();
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-md">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Choose Your Telescope</h2>
        <p className="text-gray-400">This determines how objects fill your field of view</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-6 max-h-[50vh] overflow-y-auto pr-1">
        {TELESCOPE_PRESETS.map(preset => (
          <button
            key={preset.id}
            type="button"
            onClick={() => {
              setSelected(preset.id);
              setError(null);
            }}
            className={`p-3 rounded-xl border text-left transition-colors ${
              selected === preset.id
                ? 'border-sky-500 bg-sky-500/10'
                : 'border-night-600 bg-night-800 hover:bg-night-700'
            }`}
          >
            <div className="font-medium text-white text-sm">{preset.name}</div>
            {preset.id !== 'custom' && (
              <div className="text-xs text-gray-400 mt-1">
                {formatFOV(preset.fovWidth, preset.fovHeight)}
              </div>
            )}
            {preset.id === 'custom' && (
              <div className="text-xs text-gray-400 mt-1">Enter your FOV</div>
            )}
          </button>
        ))}
      </div>

      {selected === 'custom' && (
        <div className="space-y-3 mb-6">
          <div>
            <label htmlFor="custom-fov-width" className="block text-sm text-gray-300 mb-1">
              FOV Width (arcmin)
            </label>
            <input
              id="custom-fov-width"
              type="number"
              step="any"
              min={MIN_CUSTOM_FOV}
              max={MAX_CUSTOM_FOV}
              value={customWidth}
              onChange={e => {
                setCustomWidth(e.target.value);
                setError(null);
              }}
              placeholder={`${MIN_CUSTOM_FOV}–${MAX_CUSTOM_FOV}`}
              className="w-full px-4 py-2 bg-night-800 border border-night-600 rounded-xl text-white placeholder-gray-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
            />
          </div>
          <div>
            <label htmlFor="custom-fov-height" className="block text-sm text-gray-300 mb-1">
              FOV Height (arcmin)
            </label>
            <input
              id="custom-fov-height"
              type="number"
              step="any"
              min={MIN_CUSTOM_FOV}
              max={MAX_CUSTOM_FOV}
              value={customHeight}
              onChange={e => {
                setCustomHeight(e.target.value);
                setError(null);
              }}
              placeholder={`${MIN_CUSTOM_FOV}–${MAX_CUSTOM_FOV}`}
              className="w-full px-4 py-2 bg-night-800 border border-night-600 rounded-xl text-white placeholder-gray-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleSkip}
          className="text-gray-400 hover:text-white transition-colors text-sm"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={handleContinue}
          className="px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl transition-colors font-medium"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
