import {
  AlertTriangle,
  Calendar,
  CircleDot,
  Moon,
  Sparkles,
  Star,
  Sun,
  Target,
} from 'lucide-react';
import { describeLunarApsis } from '@/lib/astronomy/lunar-apsis';
import { getEclipseSeasonDescription } from '@/lib/astronomy/lunar-nodes';
import { getMoonPhaseEmoji, getMoonPhaseName } from '@/lib/astronomy/moon-phases';
import { getPlanetApsisDescription } from '@/lib/astronomy/planet-apsis';
import { getVenusPeakDescription } from '@/lib/astronomy/venus-peak';
import { describeLunarEclipse, describeSolarEclipse } from '@/lib/events/eclipses';
import { describeSeasonalMarker, getSeasonalMarkerName } from '@/lib/events/seasons';
import { getTransitAlertSummary } from '@/lib/events/transits';
import { formatTime, getNightLabel } from '@/lib/utils/format';
import { useApp } from '@/stores/AppContext';
import type { AstronomicalEvents } from '@/types';
import CloseApproachCard from './CloseApproachCard';
import SpaceWeatherCard from './SpaceWeatherCard';

interface AstronomicalEventsSectionProps {
  events: AstronomicalEvents;
  nightDate: Date;
}

function hasAnyEvent(
  events: AstronomicalEvents,
  hasNeoApproaches: boolean,
  hasSpaceWeather: boolean
): boolean {
  return !!(
    events.lunarEclipse ||
    events.solarEclipse ||
    events.lunarApsis?.isSupermoon ||
    events.seasonalMarker ||
    events.oppositions.some(o => o.isActive) ||
    events.maxElongations.some(e => Math.abs(e.daysUntil) <= 3) ||
    events.moonPhaseEvent ||
    events.eclipseSeason?.isActive ||
    events.venusPeak?.isNearPeak ||
    events.planetPerihelia?.length ||
    (events.planetaryTransit && events.planetaryTransit.yearsUntil <= 2) ||
    hasNeoApproaches ||
    hasSpaceWeather
  );
}

export default function AstronomicalEventsSection({
  events,
  nightDate,
}: AstronomicalEventsSectionProps) {
  const hasNeoApproaches = events.neoCloseApproaches && events.neoCloseApproaches.length > 0;
  const hasSpaceWeather =
    events.spaceWeather &&
    (events.spaceWeather.geomagneticStorms.length > 0 ||
      events.spaceWeather.solarFlares.length > 0);

  if (!hasAnyEvent(events, !!hasNeoApproaches, !!hasSpaceWeather)) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-night-700 bg-night-900">
      <div className="border-night-700 border-b px-4 py-3">
        <h3 className="flex items-center gap-2 font-semibold text-white">
          <Calendar className="h-4 w-4 text-indigo-400" />
          Astronomical Events
        </h3>
      </div>
      <div className="space-y-3 p-4">
        <CelestialEventCards events={events} nightDate={nightDate} />
      </div>

      {hasNeoApproaches && (
        <div className="mt-4">
          <CloseApproachCard approaches={events.neoCloseApproaches} nightDate={nightDate} />
        </div>
      )}

      {hasSpaceWeather && events.spaceWeather && (
        <div className="mt-4">
          <SpaceWeatherCard
            spaceWeather={events.spaceWeather}
            auroraForecast={events.auroraForecast}
          />
        </div>
      )}
    </div>
  );
}

function CelestialEventCards({
  events,
  nightDate,
}: {
  events: AstronomicalEvents;
  nightDate: Date;
}) {
  const { state } = useApp();
  const timezone = state.location?.timezone;

  return (
    <>
      {events.lunarEclipse && (
        <EventCard
          icon={<Moon className="h-4 w-4 text-orange-400" />}
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

      {events.solarEclipse && (
        <EventCard
          icon={<Sun className="h-4 w-4 text-yellow-400" />}
          title="Solar Eclipse"
          description={describeSolarEclipse(events.solarEclipse)}
          time={events.solarEclipse.peakTime}
          isHighlight={events.solarEclipse.kind === 'total'}
          details={`${(events.solarEclipse.obscuration * 100).toFixed(0)}% obscuration at ${events.solarEclipse.altitude.toFixed(0)}° altitude`}
        />
      )}

      {events.lunarApsis?.isSupermoon && (
        <EventCard
          icon={<Moon className="h-4 w-4 text-yellow-300" />}
          title="Supermoon"
          description={describeLunarApsis(events.lunarApsis)}
          time={events.lunarApsis.date}
          isHighlight
          details={`Distance: ${events.lunarApsis.distanceKm.toLocaleString()} km`}
        />
      )}

      {events.oppositions
        .filter(o => o.isActive)
        .map(opposition => (
          <EventCard
            key={opposition.planet}
            icon={<Target className="h-4 w-4 text-red-400" />}
            title={`${opposition.planet} at Opposition`}
            description={
              opposition.daysUntil === 0
                ? `Opposition ${getNightLabel(nightDate)}!`
                : opposition.daysUntil < 0
                  ? `${Math.abs(opposition.daysUntil)} days ago`
                  : `In ${opposition.daysUntil} days`
            }
            time={opposition.date}
            isHighlight={Math.abs(opposition.daysUntil) <= 3}
            details="Best time to observe - planet is closest and brightest"
          />
        ))}

      {events.maxElongations
        .filter(e => Math.abs(e.daysUntil) <= 3)
        .map(elongation => (
          <EventCard
            key={elongation.planet}
            icon={<CircleDot className="h-4 w-4 text-purple-400" />}
            title={`${elongation.planet} Maximum Elongation`}
            description={`${elongation.elongationDeg.toFixed(1)}° ${elongation.isEastern ? 'east' : 'west'} of Sun`}
            time={elongation.date}
            isHighlight={elongation.daysUntil === 0}
            details={elongation.isEastern ? 'Best evening visibility' : 'Best morning visibility'}
          />
        ))}

      {events.seasonalMarker && events.seasonalMarker.daysUntil <= 1 && (
        <EventCard
          icon={<Sun className="h-4 w-4 text-amber-400" />}
          title={getSeasonalMarkerName(events.seasonalMarker.type)}
          description={describeSeasonalMarker(events.seasonalMarker)}
          time={events.seasonalMarker.time}
          isHighlight
        />
      )}

      {events.moonPhaseEvent && (
        <EventCard
          icon={<span className="text-lg">{getMoonPhaseEmoji(events.moonPhaseEvent.phase)}</span>}
          title={getMoonPhaseName(events.moonPhaseEvent.phase)}
          description={`Exact ${getMoonPhaseName(events.moonPhaseEvent.phase).toLowerCase()} ${getNightLabel(nightDate)}`}
          time={events.moonPhaseEvent.time}
          isHighlight={
            events.moonPhaseEvent.phase === 'full' || events.moonPhaseEvent.phase === 'new'
          }
          details={`at ${formatTime(events.moonPhaseEvent.time, timezone)}`}
        />
      )}

      {events.eclipseSeason?.isActive && (
        <EventCard
          icon={<AlertTriangle className="h-4 w-4 text-orange-400" />}
          title="Eclipse Season Active"
          description={getEclipseSeasonDescription(events.eclipseSeason)}
          time={events.eclipseSeason.nodeCrossingTime}
          isHighlight
          details="Watch for potential eclipses"
        />
      )}

      {events.venusPeak?.isNearPeak && (
        <EventCard
          icon={<Star className="h-4 w-4 text-yellow-200" />}
          title="Venus at Peak Brightness"
          description={getVenusPeakDescription(events.venusPeak)}
          time={events.venusPeak.peakDate}
          isHighlight={events.venusPeak.daysUntil <= 7}
          details={`Magnitude: ${events.venusPeak.peakMagnitude.toFixed(1)}`}
        />
      )}

      {events.planetPerihelia?.map(apsis => (
        <EventCard
          key={`${apsis.planet}-perihelion`}
          icon={<Sparkles className="h-4 w-4 text-green-400" />}
          title={`${apsis.planet} Near Perihelion`}
          description={getPlanetApsisDescription(apsis)}
          time={apsis.date}
          isHighlight={apsis.brightnessBoostPercent >= 10}
          details={
            apsis.brightnessBoostPercent > 0
              ? `+${apsis.brightnessBoostPercent}% brighter`
              : undefined
          }
        />
      ))}

      {events.planetaryTransit && events.planetaryTransit.yearsUntil <= 2 && (
        <EventCard
          icon={<Sun className="h-4 w-4 text-red-400" />}
          title={`${events.planetaryTransit.planet} Transit Coming!`}
          description={getTransitAlertSummary(events.planetaryTransit)}
          time={events.planetaryTransit.peak}
          isHighlight
          details="Rare event - mark your calendar!"
        />
      )}
    </>
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
  const { state } = useApp();
  const timezone = state.location?.timezone;
  return (
    <div
      className={`rounded-lg p-3 ${
        isHighlight ? 'border border-indigo-500/30 bg-indigo-500/10' : 'bg-night-800'
      }`}
    >
      <div className="mb-1 flex items-center gap-2">
        {icon}
        <span className="font-medium text-white">{title}</span>
      </div>
      <p className="text-gray-400 text-sm">{description}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-gray-500 text-xs">
          {time.toLocaleDateString()} at {formatTime(time, timezone)}
        </span>
        {details && <span className="text-gray-500 text-xs">{details}</span>}
      </div>
    </div>
  );
}
