import type { NightForecast } from '@/types';
import AuroraAlertCard from '../cards/AuroraAlertCard';
import NightQualityCard from '../cards/NightQualityCard';
import WeatherSummaryCard from '../cards/WeatherSummaryCard';

interface OverviewTabProps {
  forecast: NightForecast;
}

export default function OverviewTab({ forecast }: OverviewTabProps) {
  return (
    <div className="space-y-4">
      <NightQualityCard forecast={forecast} />
      {forecast.astronomicalEvents.auroraForecast && (
        <AuroraAlertCard forecast={forecast.astronomicalEvents.auroraForecast} />
      )}
      <WeatherSummaryCard forecast={forecast} />
    </div>
  );
}
