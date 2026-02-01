import { Orbit, Star } from 'lucide-react';
import type { AstronomicalEvents, Conjunction, MeteorShower } from '@/types';
import AstronomicalEventsSection from './AstronomicalEventsSection';
import MeteorShowerCard from './MeteorShowerCard';

interface EventsSectionProps {
  conjunctions: Conjunction[];
  meteorShowers: MeteorShower[];
  astronomicalEvents?: AstronomicalEvents;
  latitude: number;
}

export default function EventsSection({
  conjunctions,
  meteorShowers,
  astronomicalEvents,
  latitude: _latitude,
}: EventsSectionProps) {
  const hasBasicEvents = conjunctions.length > 0 || meteorShowers.length > 0;
  const hasAstroEvents =
    astronomicalEvents &&
    (astronomicalEvents.lunarEclipse ||
      astronomicalEvents.solarEclipse ||
      astronomicalEvents.lunarApsis?.isSupermoon ||
      astronomicalEvents.seasonalMarker ||
      astronomicalEvents.oppositions.some(o => o.isActive) ||
      astronomicalEvents.maxElongations.some(e => Math.abs(e.daysUntil) <= 3));

  // Jupiter Moons is now shown in TonightHighlights after Planets category
  if (!hasBasicEvents && !hasAstroEvents) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Astronomical Events (eclipses, oppositions, etc.) */}
      {hasAstroEvents && astronomicalEvents && (
        <AstronomicalEventsSection events={astronomicalEvents} />
      )}

      {/* Conjunctions */}
      {conjunctions.length > 0 && (
        <div className="bg-night-900 rounded-xl border border-night-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-night-700">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Orbit className="w-4 h-4 text-purple-400" />
              Planetary Events
            </h3>
          </div>
          <div className="p-4 space-y-3">
            {conjunctions.map(conjunction => (
              <div
                key={`${conjunction.object1Name}-${conjunction.object2Name}-${conjunction.time.getTime()}`}
                className={`p-3 rounded-lg ${
                  conjunction.isNotable
                    ? 'bg-purple-500/10 border border-purple-500/30'
                    : 'bg-night-800'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {conjunction.isNotable && <Star className="w-4 h-4 text-yellow-400" />}
                  <span className="text-white font-medium">
                    {conjunction.object1Name} - {conjunction.object2Name}
                  </span>
                </div>
                <p className="text-sm text-gray-400">{conjunction.description}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Separation: {conjunction.separationDegrees.toFixed(1)}°
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meteor Showers - Enhanced with IAU data */}
      {meteorShowers.length > 0 && <MeteorShowerCard showers={meteorShowers} />}
    </div>
  );
}
