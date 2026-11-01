import type { HorizonProfile, Location, NightForecast } from '@/types';
import AuroraNowCard from '../cards/AuroraNowCard';
import SpaceWeatherOutlookCard from '../cards/SpaceWeatherOutlookCard';
import VariableStarsCard from '../cards/VariableStarsCard';
import EventsSection from '../EventsSection';
import SatellitePassesCard from '../SatellitePassesCard';

interface EventsTabProps {
  forecast: NightForecast;
  location: Location;
  horizonProfile: HorizonProfile;
}

export default function EventsTab({ forecast, location, horizonProfile }: EventsTabProps) {
  return (
    <div className="space-y-4">
      <EventsSection
        conjunctions={forecast.conjunctions}
        meteorShowers={forecast.meteorShowers}
        astronomicalEvents={forecast.astronomicalEvents}
        latitude={location.latitude}
        nightDate={forecast.nightInfo.date}
      />
      <SpaceWeatherOutlookCard nightInfo={forecast.nightInfo} timezone={location.timezone} />
      <AuroraNowCard location={location} weather={forecast.weather} />
      <VariableStarsCard nightDate={forecast.nightInfo.date} timezone={location.timezone} />
      <SatellitePassesCard
        nightInfo={forecast.nightInfo}
        location={location}
        horizonProfile={horizonProfile}
      />
    </div>
  );
}
