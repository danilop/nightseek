import { Calculator, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { MAX_CUSTOM_FOV } from '@/lib/telescopes';
import {
  calculateFOV,
  type FOVCalculatorResult,
  validateFOVCalculatorInput,
} from '@/lib/telescopes/fov-calculator';

interface FOVCalculatorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (fov: { width: number; height: number }) => void;
}

export default function FOVCalculatorDialog({
  isOpen,
  onClose,
  onApply,
}: FOVCalculatorDialogProps) {
  const [focalLength, setFocalLength] = useState('');
  const [pixelSize, setPixelSize] = useState('');
  const [resWidth, setResWidth] = useState('');
  const [resHeight, setResHeight] = useState('');
  const [barlowFactor, setBarlowFactor] = useState('1');

  const computed = useMemo((): FOVCalculatorResult | null => {
    const fl = parseFloat(focalLength);
    const ps = parseFloat(pixelSize);
    const rw = parseFloat(resWidth);
    const rh = parseFloat(resHeight);
    const bf = parseFloat(barlowFactor);

    if ([fl, ps, rw, rh].some(Number.isNaN)) return null;
    const barlow = Number.isNaN(bf) ? 1 : bf;

    const validation = validateFOVCalculatorInput({
      focalLengthMm: fl,
      pixelSizeUm: ps,
      sensorResolutionWidth: rw,
      sensorResolutionHeight: rh,
      barlowFactor: barlow,
    });

    if (!validation.valid) return null;

    return calculateFOV({
      focalLengthMm: fl,
      pixelSizeUm: ps,
      sensorResolutionWidth: rw,
      sensorResolutionHeight: rh,
      barlowFactor: barlow,
    });
  }, [focalLength, pixelSize, resWidth, resHeight, barlowFactor]);

  const exceedsMax =
    computed !== null &&
    (computed.fovWidthArcmin > MAX_CUSTOM_FOV || computed.fovHeightArcmin > MAX_CUSTOM_FOV);

  const canApply = computed !== null && !exceedsMax;

  const handleApply = useCallback(() => {
    if (!computed || exceedsMax) return;
    onApply({
      width: Math.round(computed.fovWidthArcmin),
      height: Math.round(computed.fovHeightArcmin),
    });
    onClose();
  }, [computed, exceedsMax, onApply, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={e => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-xl border border-night-600 bg-night-800 p-5 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-sky-400" />
            <h3 className="font-semibold text-base text-white">Calculate FOV</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 transition-colors hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Fields */}
        <div className="space-y-3">
          <FieldInput
            id="calc-focal-length"
            label="Focal Length (mm)"
            value={focalLength}
            onChange={setFocalLength}
            placeholder="e.g. 100"
          />
          <FieldInput
            id="calc-pixel-size"
            label="Pixel Size (μm)"
            value={pixelSize}
            onChange={setPixelSize}
            placeholder="e.g. 1.4"
            step="0.01"
          />
          <div>
            <label htmlFor="calc-res-width" className="mb-1 block text-gray-400 text-xs">
              Sensor Resolution (px)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                id="calc-res-width"
                type="number"
                min="1"
                value={resWidth}
                onChange={e => setResWidth(e.target.value)}
                placeholder="Width"
                className="w-full rounded-lg border border-night-700 bg-night-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <input
                id="calc-res-height"
                type="number"
                min="1"
                value={resHeight}
                onChange={e => setResHeight(e.target.value)}
                placeholder="Height"
                className="w-full rounded-lg border border-night-700 bg-night-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>
          <FieldInput
            id="calc-barlow"
            label="Barlow / Reducer"
            value={barlowFactor}
            onChange={setBarlowFactor}
            placeholder="1.0"
            step="0.01"
          />
        </div>

        {/* Computed Result */}
        {computed && (
          <div className="mt-4 rounded-lg border border-night-700 bg-night-900 p-3">
            <p className="font-medium text-sky-400 text-sm">
              {computed.fovWidthArcmin}' &times; {computed.fovHeightArcmin}'{' '}
              <span className="font-normal text-gray-400">
                ({computed.fovWidthDeg}&deg; &times; {computed.fovHeightDeg}&deg;)
              </span>
            </p>
            <p className="mt-1 text-gray-400 text-xs">
              Image scale: {computed.imageScaleArcsecPerPx} &Prime;/px
            </p>
            {exceedsMax && (
              <p className="mt-1 text-amber-400 text-xs">Exceeds maximum FOV ({MAX_CUSTOM_FOV}')</p>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg bg-night-700 py-2.5 font-medium text-gray-300 text-sm transition-colors hover:bg-night-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!canApply}
            className={`flex-1 rounded-lg py-2.5 font-medium text-sm text-white transition-colors ${
              canApply
                ? 'bg-sky-600 hover:bg-sky-500'
                : 'cursor-not-allowed bg-sky-600/50 opacity-50'
            }`}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  step,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  step?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-gray-400 text-xs">
        {label}
      </label>
      <input
        id={id}
        type="number"
        min="0"
        step={step ?? 'any'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-night-700 bg-night-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
      />
    </div>
  );
}
