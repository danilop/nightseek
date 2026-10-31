import type { Location, NightForecast } from '@/types';
import AuroraNowCard from '../cards/AuroraNowCard';
import ForecastEvidenceCard from '../cards/ForecastEvidenceCard';
import LocationQualityCard from '../cards/LocationQualityCard';
import MoonSummaryCard from '../cards/MoonSummaryCard';
import NightQualityCard from '../cards/NightQualityCard';
import SourceHealthCard from '../cards/SourceHealthCard';
import SpaceWeatherOutlookCard from '../cards/SpaceWeatherOutlookCard';
import WeatherSummaryCard from '../cards/WeatherSummaryCard';

interface OverviewTabProps {
  forecast: NightForecast;
  location: Location;
}

export default function OverviewTab({ forecast, location }: OverviewTabProps) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <NightQualityCard forecast={forecast} location={location} timezone={location.timezone} />
      </div>
      <MoonSummaryCard nightInfo={forecast.nightInfo} timezone={location.timezone} />
      <SpaceWeatherOutlookCard nightInfo={forecast.nightInfo} timezone={location.timezone} />
      <AuroraNowCard location={location} weather={forecast.weather} />
      <ForecastEvidenceCard forecast={forecast} location={location} />
      <WeatherSummaryCard forecast={forecast} timezone={location.timezone} />
      <SourceHealthCard />
      <LocationQualityCard latitude={location.latitude} longitude={location.longitude} />
    </div>
  );
}
