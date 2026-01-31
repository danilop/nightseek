import { Orbit, Sparkles, Star } from 'lucide-react';
import { getAdjustedHourlyRate } from '@/lib/events/meteor-showers';
import type { AstronomicalEvents, Conjunction, MeteorShower } from '@/types';
import AstronomicalEventsSection from './AstronomicalEventsSection';
import JupiterMoonsCard from './JupiterMoonsCard';

interface EventsSectionProps {
  conjunctions: Conjunction[];
  meteorShowers: MeteorShower[];
  astronomicalEvents?: AstronomicalEvents;
}

export default function EventsSection({
  conjunctions,
  meteorShowers,
  astronomicalEvents,
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
  const hasJupiterMoons = astronomicalEvents?.jupiterMoons;

  if (!hasBasicEvents && !hasAstroEvents && !hasJupiterMoons) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Astronomical Events (eclipses, oppositions, etc.) */}
      {hasAstroEvents && astronomicalEvents && (
        <AstronomicalEventsSection events={astronomicalEvents} />
      )}

      {/* Jupiter Moons */}
      {hasJupiterMoons && astronomicalEvents?.jupiterMoons && (
        <JupiterMoonsCard
          positions={astronomicalEvents.jupiterMoons.positions}
          events={astronomicalEvents.jupiterMoons.events}
        />
      )}

      {/* Conjunctions and Meteor Showers */}
      {hasBasicEvents && (
        <div className="grid sm:grid-cols-2 gap-4">
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

          {/* Meteor Showers */}
          {meteorShowers.length > 0 && (
            <div className="bg-night-900 rounded-xl border border-night-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-night-700">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Active Meteor Showers
                </h3>
              </div>
              <div className="p-4 space-y-3">
                {meteorShowers.map(shower => {
                  const adjustedRate = getAdjustedHourlyRate(shower);
                  const daysFromPeak = shower.daysFromPeak ?? 0;
                  const isNearPeak = Math.abs(daysFromPeak) <= 2;

                  return (
                    <div
                      key={shower.code}
                      className={`p-3 rounded-lg ${
                        isNearPeak ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-night-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white font-medium">{shower.name}</span>
                        <span className="text-sm text-amber-400">~{adjustedRate}/hr</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span>ZHR: {shower.zhr}</span>
                        {shower.radiantAltitude !== null && (
                          <span>Radiant: {Math.round(shower.radiantAltitude)}°</span>
                        )}
                        <span>
                          {daysFromPeak === 0
                            ? 'Peak tonight!'
                            : daysFromPeak > 0
                              ? `${Math.abs(daysFromPeak).toFixed(0)}d past peak`
                              : `${Math.abs(daysFromPeak).toFixed(0)}d to peak`}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Parent: {shower.parentObject}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
