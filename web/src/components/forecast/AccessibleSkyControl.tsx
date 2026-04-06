import { Compass, RotateCcw } from 'lucide-react';
import {
  getSectorAltitudeLabel,
  getSectorToneClass,
  HORIZON_SECTOR_CONFIGS,
} from '@/lib/utils/horizon-profile';
import type { HorizonProfile } from '@/types';

interface AccessibleSkyControlProps {
  horizonProfile: HorizonProfile;
  onCycleSector: (sectorLabel: HorizonProfile['sectors'][number]['label']) => void;
  onReset: () => void;
}

export default function AccessibleSkyControl({
  horizonProfile,
  onCycleSector,
  onReset,
}: AccessibleSkyControlProps) {
  return (
    <div className="rounded-lg border border-night-700 bg-night-900 p-4">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-sky-400" />
            <h4 className="font-medium text-sm text-white">Accessible sky</h4>
          </div>
          <p className="mt-1 text-gray-400 text-xs">
            Tap a direction to cycle its minimum visible altitude. This hides impossible targets and
            prioritizes longer accessible windows.
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1 rounded-md bg-night-800 px-2.5 py-1.5 text-gray-300 text-xs transition-colors hover:bg-night-700"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {HORIZON_SECTOR_CONFIGS.map(({ label }) => {
          const sector = horizonProfile.sectors.find(candidate => candidate.label === label);
          const minAltitude = sector?.minAltitude ?? 0;

          return (
            <button
              key={label}
              type="button"
              onClick={() => onCycleSector(label)}
              className={`rounded-lg border px-2 py-2 text-center transition-colors ${getSectorToneClass(minAltitude)}`}
              title={`${label}: ${getSectorAltitudeLabel(minAltitude)}`}
            >
              <div className="font-semibold text-sm">{label}</div>
              <div className="mt-0.5 text-[11px]">{getSectorAltitudeLabel(minAltitude)}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
