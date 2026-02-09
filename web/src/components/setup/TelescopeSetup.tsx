import { Calculator } from 'lucide-react';
import { useMemo, useState } from 'react';
import FOVCalculatorDialog from '@/components/telescope/FOVCalculatorDialog';
import {
  formatFOV,
  MAX_CUSTOM_FOV,
  MIN_CUSTOM_FOV,
  TELESCOPE_PRESETS,
  validateCustomFOV,
} from '@/lib/telescopes';
import { useApp } from '@/stores/AppContext';
import type { TelescopePreset, TelescopePresetId } from '@/types';

interface TelescopeSetupProps {
  onComplete: () => void;
}

interface BrandGroup {
  brand: string;
  presets: TelescopePreset[];
}

const GENERIC_PRESET = TELESCOPE_PRESETS.find(p => p.id === 'generic')!;

function groupPresetsByBrand(): BrandGroup[] {
  const brandPrefixes: [string, string][] = [
    ['Dwarf', 'DWARF'],
    ['Seestar', 'Seestar'],
    ['Unistellar', 'Unistellar'],
    ['Vaonis', 'Vaonis'],
  ];

  const groups = new Map<string, TelescopePreset[]>();
  const other: TelescopePreset[] = [];

  for (const preset of TELESCOPE_PRESETS) {
    if (preset.id === 'generic') continue;
    const matched = brandPrefixes.find(([prefix]) => preset.name.startsWith(prefix));
    if (matched) {
      const [, brand] = matched;
      const existing = groups.get(brand) ?? [];
      existing.push(preset);
      groups.set(brand, existing);
    } else {
      other.push(preset);
    }
  }

  const result: BrandGroup[] = [];
  for (const [, brand] of brandPrefixes) {
    const presets = groups.get(brand);
    if (presets?.length) {
      result.push({ brand, presets });
    }
  }
  if (other.length) {
    result.push({ brand: 'Other', presets: other });
  }
  return result;
}

export default function TelescopeSetup({ onComplete }: TelescopeSetupProps) {
  const { updateSettings } = useApp();
  const [selected, setSelected] = useState<TelescopePresetId>('generic');
  const [customWidth, setCustomWidth] = useState('');
  const [customHeight, setCustomHeight] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);

  const brandGroups = useMemo(groupPresetsByBrand, []);

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
    updateSettings({ telescope: 'generic', customFOV: null });
    onComplete();
  };

  return (
    <div className="container mx-auto max-w-md px-4 py-8">
      <div className="mb-6 text-center">
        <h2 className="mb-2 font-bold text-2xl text-white">Choose Your Telescope</h2>
        <p className="text-gray-400">This determines how objects fill your field of view</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="mb-6 max-h-[50vh] space-y-5 overflow-y-auto pr-1">
        {/* Generic / no telescope option */}
        <button
          type="button"
          onClick={() => {
            setSelected('generic');
            setError(null);
          }}
          className={`w-full rounded-xl border p-4 text-left transition-colors ${
            selected === 'generic'
              ? 'border-sky-500 bg-sky-500/10 ring-1 ring-sky-500/50'
              : 'border-night-600 bg-night-800 hover:bg-night-700'
          }`}
        >
          <div className="font-medium text-white">{GENERIC_PRESET.name}</div>
          <div className="mt-1 text-gray-400 text-xs">
            I don't have a telescope yet or it's not listed
          </div>
        </button>

        {/* Brand groups */}
        {brandGroups.map(group => (
          <div key={group.brand}>
            <h3 className="mb-2 font-medium text-gray-400 text-xs uppercase tracking-wider">
              {group.brand}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {group.presets.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setSelected(preset.id);
                    setError(null);
                  }}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    selected === preset.id
                      ? 'border-sky-500 bg-sky-500/10 ring-1 ring-sky-500/50'
                      : 'border-night-600 bg-night-800 hover:bg-night-700'
                  }`}
                >
                  <div className="font-medium text-sm text-white">{preset.name}</div>
                  {preset.id !== 'custom' && (
                    <div className="mt-1 text-gray-400 text-xs">
                      {formatFOV(preset.fovWidth, preset.fovHeight)}
                    </div>
                  )}
                  {preset.id === 'custom' && (
                    <div className="mt-1 text-gray-400 text-xs">Enter your FOV</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selected === 'custom' && (
        <div className="mb-6 space-y-3">
          <button
            type="button"
            onClick={() => setShowCalculator(true)}
            className="flex items-center gap-1.5 text-sky-400 text-sm transition-colors hover:text-sky-300"
          >
            <Calculator className="h-3.5 w-3.5" />
            Calculate from equipment
          </button>
          <div>
            <label htmlFor="custom-fov-width" className="mb-1 block text-gray-300 text-sm">
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
              className="w-full rounded-xl border border-night-600 bg-night-800 px-4 py-2 text-white placeholder-gray-500 transition-colors focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <div>
            <label htmlFor="custom-fov-height" className="mb-1 block text-gray-300 text-sm">
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
              className="w-full rounded-xl border border-night-600 bg-night-800 px-4 py-2 text-white placeholder-gray-500 transition-colors focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <button
            type="button"
            onClick={handleSkip}
            className="text-gray-400 text-sm transition-colors hover:text-white"
          >
            Skip
          </button>
          <p className="mt-1 text-gray-500 text-xs">You can always change this in Settings</p>
        </div>
        <button
          type="button"
          onClick={handleContinue}
          className="rounded-xl bg-sky-600 px-6 py-3 font-medium text-white transition-colors hover:bg-sky-500"
        >
          Continue
        </button>
      </div>

      <FOVCalculatorDialog
        isOpen={showCalculator}
        onClose={() => setShowCalculator(false)}
        onApply={fov => {
          setCustomWidth(fov.width.toString());
          setCustomHeight(fov.height.toString());
          setError(null);
        }}
      />
    </div>
  );
}
