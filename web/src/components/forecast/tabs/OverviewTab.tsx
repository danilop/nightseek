import type { ReactNode } from 'react';
import ExplainSection from '@/components/ui/ExplainSection';
import { useApp } from '@/stores/AppContext';
import type { Location, NightForecast } from '@/types';
import ForecastEvidenceCard from '../cards/ForecastEvidenceCard';
import LocationQualityCard from '../cards/LocationQualityCard';
import MoonSummaryCard from '../cards/MoonSummaryCard';
import NightQualityCard from '../cards/NightQualityCard';
import SourceHealthCard from '../cards/SourceHealthCard';
import WeatherSummaryCard from '../cards/WeatherSummaryCard';

interface OverviewTabProps {
  forecast: NightForecast;
  location: Location;
  session: ReactNode;
}

export default function OverviewTab({ forecast, location, session }: OverviewTabProps) {
  const { state } = useApp();
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <NightQualityCard
          units={state.settings.units}
          forecast={forecast}
          location={location}
          timezone={location.timezone}
        />
      </div>
      <div className="lg:col-span-2">{session}</div>
      <MoonSummaryCard nightInfo={forecast.nightInfo} timezone={location.timezone} />
      <ForecastEvidenceCard forecast={forecast} location={location} />
      <ExplainSection
        title="Weather details"
        summary={
          forecast.weather ? 'Wind, dew, transparency & hourly values' : 'Weather unavailable'
        }
      >
        <WeatherSummaryCard forecast={forecast} timezone={location.timezone} />
      </ExplainSection>
      <SourceHealthCard />
      <LocationQualityCard latitude={location.latitude} longitude={location.longitude} />
    </div>
  );
}
