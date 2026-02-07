import type { Location, NightInfo } from '@/types';
import SkyChart from '../SkyChart';

interface SkyTabProps {
  nightInfo: NightInfo;
  location: Location;
}

export default function SkyTab({ nightInfo, location }: SkyTabProps) {
  return (
    <div className="space-y-4">
      <SkyChart nightInfo={nightInfo} location={location} />
      {nightInfo.localSiderealTimeAtMidnight && (
        <div className="flex items-center gap-3 rounded-xl border border-night-700 bg-night-900 p-4">
          <span className="text-gray-400 text-sm">Local Sidereal Time at Midnight</span>
          <span className="font-medium text-white">{nightInfo.localSiderealTimeAtMidnight}</span>
        </div>
      )}
    </div>
  );
}
