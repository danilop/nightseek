import SkyChart from '@/components/forecast/SkyChart';
import ExplainSection from '@/components/ui/ExplainSection';
import type { Location, NightInfo, SkyMapFocus } from '@/types';

interface SkyTabProps {
  nightInfo: NightInfo;
  location: Location;
  focus?: SkyMapFocus | null;
}

export default function SkyTab({ nightInfo, location, focus }: SkyTabProps) {
  return (
    <div className="space-y-4">
      <SkyChart nightInfo={nightInfo} location={location} focus={focus} />
      {nightInfo.localSiderealTimeAtMidnight && (
        <ExplainSection title="Sky coordinates">
          <span className="text-gray-400 text-sm">
            Local sidereal time at observing-window midpoint
          </span>
          <span className="font-medium text-white">{nightInfo.localSiderealTimeAtMidnight}</span>
        </ExplainSection>
      )}
    </div>
  );
}
