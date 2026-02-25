import { Orbit, Star } from 'lucide-react';
import { Card } from '@/components/ui/Card';
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
  const hasSpaceWeather =
    astronomicalEvents?.spaceWeather &&
    (astronomicalEvents.spaceWeather.geomagneticStorms.length > 0 ||
      astronomicalEvents.spaceWeather.solarFlares.length > 0);
  const hasAstroEvents =
    astronomicalEvents &&
    (astronomicalEvents.lunarEclipse ||
      astronomicalEvents.solarEclipse ||
      astronomicalEvents.lunarApsis?.isSupermoon ||
      astronomicalEvents.seasonalMarker ||
      astronomicalEvents.oppositions.some(o => o.isActive) ||
      astronomicalEvents.maxElongations.some(e => Math.abs(e.daysUntil) <= 3) ||
      hasSpaceWeather);

  // Jupiter Moons is now shown in TonightHighlights after Planets category
  if (!hasBasicEvents && !hasAstroEvents) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Astronomical Events (eclipses, oppositions, etc.) */}
      {hasAstroEvents && astronomicalEvents && (
        <AstronomicalEventsSection events={astronomicalEvents} nightDate={nightDate} />
      )}

      {/* Conjunctions */}
      {conjunctions.length > 0 && (
        <Card>
          <div className="border-night-700 border-b px-4 py-3">
            <h3 className="flex items-center gap-2 font-semibold text-white">
              <Orbit className="h-4 w-4 text-purple-400" />
              Planetary Events
            </h3>
          </div>
          <div className="space-y-3 p-4">
            {conjunctions.map(conjunction => (
              <div
                key={`${conjunction.object1Name}-${conjunction.object2Name}-${conjunction.time.getTime()}`}
                className={`rounded-lg p-3 ${
                  conjunction.isNotable
                    ? 'border border-purple-500/30 bg-purple-500/10'
                    : 'bg-night-800'
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  {conjunction.isNotable && <Star className="h-4 w-4 text-yellow-400" />}
                  <span className="font-medium text-white">
                    {conjunction.object1Name} - {conjunction.object2Name}
                  </span>
                </div>
                <p className="text-gray-400 text-sm">{conjunction.description}</p>
                <p className="mt-1 text-gray-500 text-xs">
                  Separation: {conjunction.separationDegrees.toFixed(1)}°
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Meteor Showers - Enhanced with IAU data */}
      {meteorShowers.length > 0 && (
        <MeteorShowerCard showers={meteorShowers} nightDate={nightDate} />
      )}
    </div>
  );
}
