import { Moon, Sun, Calendar, CircleDot, Target } from 'lucide-react';
import type { AstronomicalEvents } from '@/types';
import { formatTime } from '@/lib/utils/format';
import { describeLunarEclipse, describeSolarEclipse } from '@/lib/events/eclipses';
import { describeLunarApsis } from '@/lib/astronomy/lunar-apsis';
import { getSeasonalMarkerName, describeSeasonalMarker } from '@/lib/events/seasons';

interface AstronomicalEventsSectionProps {
  events: AstronomicalEvents;
}

export default function AstronomicalEventsSection({
  events,
}: AstronomicalEventsSectionProps) {
  const hasEvents =
    events.lunarEclipse ||
    events.solarEclipse ||
    events.lunarApsis?.isSupermoon ||
    events.seasonalMarker ||
    events.oppositions.some(o => o.isActive) ||
    events.maxElongations.some(e => Math.abs(e.daysUntil) <= 3);

  if (!hasEvents) {
    return null;
  }

  return (
    <div className="bg-night-900 rounded-xl border border-night-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-night-700">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-400" />
          Astronomical Events
        </h3>
      </div>
      <div className="p-4 space-y-3">
        {/* Lunar Eclipse */}
        {events.lunarEclipse && (
          <EventCard
            icon={<Moon className="w-4 h-4 text-orange-400" />}
            title="Lunar Eclipse"
            description={describeLunarEclipse(events.lunarEclipse)}
            time={events.lunarEclipse.peakTime}
            isHighlight={events.lunarEclipse.kind === 'total'}
            details={
              events.lunarEclipse.kind !== 'penumbral'
                ? `${events.lunarEclipse.kind.charAt(0).toUpperCase() + events.lunarEclipse.kind.slice(1)} eclipse`
                : undefined
            }
          />
        )}

        {/* Solar Eclipse */}
        {events.solarEclipse && (
          <EventCard
            icon={<Sun className="w-4 h-4 text-yellow-400" />}
            title="Solar Eclipse"
            description={describeSolarEclipse(events.solarEclipse)}
            time={events.solarEclipse.peakTime}
            isHighlight={events.solarEclipse.kind === 'total'}
            details={`${(events.solarEclipse.obscuration * 100).toFixed(0)}% obscuration at ${events.solarEclipse.altitude.toFixed(0)}° altitude`}
          />
        )}

        {/* Supermoon */}
        {events.lunarApsis?.isSupermoon && (
          <EventCard
            icon={<Moon className="w-4 h-4 text-yellow-300" />}
            title="Supermoon"
            description={describeLunarApsis(events.lunarApsis)}
            time={events.lunarApsis.date}
            isHighlight
            details={`Distance: ${events.lunarApsis.distanceKm.toLocaleString()} km`}
          />
        )}

        {/* Active Oppositions */}
        {events.oppositions
          .filter(o => o.isActive)
          .map(opposition => (
            <EventCard
              key={opposition.planet}
              icon={<Target className="w-4 h-4 text-red-400" />}
              title={`${opposition.planet} at Opposition`}
              description={
                opposition.daysUntil === 0
                  ? 'Opposition tonight!'
                  : opposition.daysUntil < 0
                  ? `${Math.abs(opposition.daysUntil)} days ago`
                  : `In ${opposition.daysUntil} days`
              }
              time={opposition.date}
              isHighlight={Math.abs(opposition.daysUntil) <= 3}
              details="Best time to observe - planet is closest and brightest"
            />
          ))}

        {/* Max Elongations */}
        {events.maxElongations
          .filter(e => Math.abs(e.daysUntil) <= 3)
          .map(elongation => (
            <EventCard
              key={elongation.planet}
              icon={<CircleDot className="w-4 h-4 text-purple-400" />}
              title={`${elongation.planet} Maximum Elongation`}
              description={`${elongation.elongationDeg.toFixed(1)}° ${elongation.isEastern ? 'east' : 'west'} of Sun`}
              time={elongation.date}
              isHighlight={elongation.daysUntil === 0}
              details={elongation.isEastern ? 'Best evening visibility' : 'Best morning visibility'}
            />
          ))}

        {/* Seasonal Marker */}
        {events.seasonalMarker && events.seasonalMarker.daysUntil <= 1 && (
          <EventCard
            icon={<Sun className="w-4 h-4 text-amber-400" />}
            title={getSeasonalMarkerName(events.seasonalMarker.type)}
            description={describeSeasonalMarker(events.seasonalMarker)}
            time={events.seasonalMarker.time}
            isHighlight
          />
        )}
      </div>
    </div>
  );
}

interface EventCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  time: Date;
  isHighlight?: boolean;
  details?: string;
}

function EventCard({
  icon,
  title,
  description,
  time,
  isHighlight = false,
  details,
}: EventCardProps) {
  return (
    <div
      className={`p-3 rounded-lg ${
        isHighlight
          ? 'bg-indigo-500/10 border border-indigo-500/30'
          : 'bg-night-800'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-white font-medium">{title}</span>
      </div>
      <p className="text-sm text-gray-400">{description}</p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-500">
          {time.toLocaleDateString()} at {formatTime(time)}
        </span>
        {details && (
          <span className="text-xs text-gray-500">{details}</span>
        )}
      </div>
    </div>
  );
}
