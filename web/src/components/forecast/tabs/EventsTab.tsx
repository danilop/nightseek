import type { Location, NightForecast } from '@/types';
import EventsSection from '../EventsSection';
import SatellitePassesCard from '../SatellitePassesCard';

interface EventsTabProps {
  forecast: NightForecast;
  location: Location;
}

export default function EventsTab({ forecast, location }: EventsTabProps) {
  return (
    <div className="space-y-4">
      <EventsSection
        conjunctions={forecast.conjunctions}
        meteorShowers={forecast.meteorShowers}
        astronomicalEvents={forecast.astronomicalEvents}
        latitude={location.latitude}
        nightDate={forecast.nightInfo.date}
      />
      <SatellitePassesCard nightInfo={forecast.nightInfo} location={location} />
    </div>
  );
}
