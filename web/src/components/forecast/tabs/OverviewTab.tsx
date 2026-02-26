import type { Location, NightForecast } from '@/types';
import AuroraAlertCard from '../cards/AuroraAlertCard';
import LocationQualityCard from '../cards/LocationQualityCard';
import NightQualityCard from '../cards/NightQualityCard';
import WeatherSummaryCard from '../cards/WeatherSummaryCard';

interface OverviewTabProps {
  forecast: NightForecast;
  location: Location;
}

export default function OverviewTab({ forecast, location }: OverviewTabProps) {
  return (
    <div className="space-y-4">
      <NightQualityCard forecast={forecast} timezone={location.timezone} />
      {forecast.astronomicalEvents.auroraForecast && (
        <AuroraAlertCard forecast={forecast.astronomicalEvents.auroraForecast} />
      )}
      <WeatherSummaryCard forecast={forecast} timezone={location.timezone} />
      <LocationQualityCard latitude={location.latitude} longitude={location.longitude} />
    </div>
  );
}
