import type { NightForecast } from '@/types';
import NightQualityCard from '../cards/NightQualityCard';
import WeatherSummaryCard from '../cards/WeatherSummaryCard';

interface OverviewTabProps {
  forecast: NightForecast;
}

export default function OverviewTab({ forecast }: OverviewTabProps) {
  return (
    <div className="space-y-4">
      <NightQualityCard forecast={forecast} />
      <WeatherSummaryCard forecast={forecast} />
    </div>
  );
}
