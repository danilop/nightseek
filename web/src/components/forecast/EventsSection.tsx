import type { AstronomicalEvents, Conjunction, MeteorShower } from '@/types';
import AstronomicalEventsSection from './AstronomicalEventsSection';
import MeteorShowerCard from './MeteorShowerCard';

interface EventsSectionProps {
  conjunctions: Conjunction[];
  meteorShowers: MeteorShower[];
  astronomicalEvents?: AstronomicalEvents;
  latitude: number;
  nightDate: Date;
}

export default function EventsSection({
  conjunctions,
  meteorShowers,
  astronomicalEvents,
  latitude: _latitude,
  nightDate,
}: EventsSectionProps) {
  const hasBasicEvents = conjunctions.length > 0 || meteorShowers.length > 0;
  // The child owns event eligibility and source-health states, including empty DONKI feeds.
  const hasAstroEvents = Boolean(astronomicalEvents);

  // Jupiter Moons is now shown in TonightHighlights after Planets category
  if (!hasBasicEvents && !hasAstroEvents) {
    return null;
  }

  return (
    <div className="space-y-4">
      <AstronomicalEventsSection
        events={astronomicalEvents}
        conjunctions={conjunctions}
        nightDate={nightDate}
      />

      {/* Meteor Showers - Enhanced with IAU data */}
      {meteorShowers.length > 0 && (
        <MeteorShowerCard showers={meteorShowers} nightDate={nightDate} />
      )}
    </div>
  );
}
