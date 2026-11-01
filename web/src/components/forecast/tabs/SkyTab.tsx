import SiderealTimeCard from '@/components/forecast/SiderealTimeCard';
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
          <SiderealTimeCard nightInfo={nightInfo} />
        </ExplainSection>
      )}
    </div>
  );
}
