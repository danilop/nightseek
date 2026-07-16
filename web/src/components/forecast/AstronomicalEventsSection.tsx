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
import { formatDate, formatTime, formatTimeRange, getNightLabel } from '@/lib/utils/format';
import { useApp } from '@/stores/AppContext';
import type { AstronomicalEvents, LunarEclipse, SolarEclipse } from '@/types';
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
      {events.lunarEclipse && <LunarEclipseCard eclipse={events.lunarEclipse} />}

      {events.solarEclipse && <SolarEclipseCard eclipse={events.solarEclipse} />}

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
                ? `Opposition ${getNightLabel(nightDate, false, timezone)}!`
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
          description={`Exact ${getMoonPhaseName(events.moonPhaseEvent.phase).toLowerCase()} ${getNightLabel(nightDate, false, timezone)}`}
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
          description={getEclipseSeasonDescription(events.eclipseSeason, nightDate, timezone)}
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
          isHighlight={false}
          details={
            apsis.solarFluxBoostPercent > 0
              ? `${apsis.solarFluxBoostPercent}% more sunlight than at mean distance`
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

function EclipseCoverageMeter({
  value,
  label,
  children,
}: {
  value: number;
  label: string;
  children: React.ReactNode;
}) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <div
        role="img"
        aria-label={`${percent}% ${label}`}
        className="grid h-16 w-16 place-items-center rounded-full p-1"
        style={{
          background: `conic-gradient(rgb(56 189 248) ${percent}%, rgb(55 65 81) ${percent}% 100%)`,
        }}
      >
        <div className="grid h-full w-full place-items-center rounded-full bg-night-900">
          {children}
          <span className="sr-only">{percent}%</span>
        </div>
      </div>
      <span className="text-[0.65rem] text-gray-500">{percent}%</span>
    </div>
  );
}

function EclipseTimeline({
  start,
  peak,
  end,
  timezone,
  labels = ['Starts', 'Maximum', 'Ends'],
}: {
  start: Date;
  peak: Date;
  end: Date;
  timezone?: string;
  labels?: [string, string, string];
}) {
  return (
    <div role="group" className="mt-3 grid grid-cols-3 gap-2" aria-label="Eclipse timeline">
      {[
        [labels[0], start],
        [labels[1], peak],
        [labels[2], end],
      ].map(([label, time], index) => (
        <div key={label as string} className="relative text-center">
          <div className="mb-1 flex items-center">
            <span className={`h-px flex-1 ${index === 0 ? 'bg-transparent' : 'bg-sky-500/40'}`} />
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            <span className={`h-px flex-1 ${index === 2 ? 'bg-transparent' : 'bg-sky-500/40'}`} />
          </div>
          <div className="text-[0.65rem] text-gray-500">{label as string}</div>
          <div className="font-medium text-gray-200 text-xs">
            {formatTime(time as Date, timezone)}
          </div>
        </div>
      ))}
    </div>
  );
}

function SolarEclipseCard({ eclipse }: { eclipse: SolarEclipse }) {
  const { state } = useApp();
  const timezone = state.location?.timezone;
  const kind = eclipse.kind.charAt(0).toUpperCase() + eclipse.kind.slice(1);
  const geometricPeakHidden =
    Math.abs(eclipse.geometricPeakTime.getTime() - eclipse.peakTime.getTime()) > 60_000;
  const visibilityClipped =
    Math.abs(eclipse.visibleStart.getTime() - eclipse.partialStart.getTime()) > 60_000 ||
    Math.abs(eclipse.visibleEnd.getTime() - eclipse.partialEnd.getTime()) > 60_000;

  return (
    <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sun className="h-4 w-4 text-yellow-400" />
          <span className="font-medium text-white">{kind} Solar Eclipse</span>
        </div>
        <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-xs text-yellow-300">
          {formatDate(eclipse.peakTime, timezone)}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <EclipseCoverageMeter value={eclipse.obscuration} label="maximum visible solar coverage">
          <Sun className="h-7 w-7 text-yellow-300" />
        </EclipseCoverageMeter>
        <div className="min-w-0 text-sm">
          <p className="text-gray-200">{describeSolarEclipse(eclipse)}</p>
          <p className="mt-1 text-gray-400 text-xs">
            Visible {formatTimeRange(eclipse.visibleStart, eclipse.visibleEnd, timezone)} · Sun{' '}
            {eclipse.altitude.toFixed(0)}° high at visible maximum
          </p>
          {eclipse.centralStart && eclipse.centralEnd && eclipse.kind !== 'partial' && (
            <p className="mt-1 text-sky-300 text-xs">
              {kind} phase {formatTimeRange(eclipse.centralStart, eclipse.centralEnd, timezone)}
            </p>
          )}
          {geometricPeakHidden && (
            <p className="mt-1 text-amber-300 text-xs">
              Geometric maximum is below the horizon; coverage shown is the observable maximum.
            </p>
          )}
        </div>
      </div>

      <EclipseTimeline
        start={eclipse.visibleStart}
        peak={eclipse.peakTime}
        end={eclipse.visibleEnd}
        timezone={timezone}
        labels={['Visible from', 'Visible max', 'Visible until']}
      />
      {visibilityClipped && (
        <p className="mt-2 text-gray-500 text-xs">
          Formal partial contacts:{' '}
          {formatTimeRange(eclipse.partialStart, eclipse.partialEnd, timezone)}. Your horizon
          shortens the visible portion shown above.
        </p>
      )}
      <p className="mt-3 rounded-md bg-red-500/10 px-2 py-1.5 text-red-200 text-xs">
        Never look at the Sun directly. Use certified ISO 12312-2 eclipse viewers or a proper solar
        filter.
      </p>
    </div>
  );
}

function LunarEclipseCard({ eclipse }: { eclipse: LunarEclipse }) {
  const { state } = useApp();
  const timezone = state.location?.timezone;
  const kind = eclipse.kind.charAt(0).toUpperCase() + eclipse.kind.slice(1);
  const timelineStart = eclipse.penumbralStart ?? eclipse.peakTime;
  const timelineEnd = eclipse.penumbralEnd ?? eclipse.peakTime;

  return (
    <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Moon className="h-4 w-4 text-orange-300" />
          <span className="font-medium text-white">{kind} Lunar Eclipse</span>
        </div>
        <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-orange-200 text-xs">
          {formatDate(eclipse.peakTime, timezone)}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <EclipseCoverageMeter value={eclipse.obscuration} label="global maximum umbral coverage">
          <Moon className="h-7 w-7 text-orange-200" />
        </EclipseCoverageMeter>
        <div className="min-w-0 text-sm">
          <p className="text-gray-200">{describeLunarEclipse(eclipse)}</p>
          {eclipse.visibleStart && eclipse.visibleEnd ? (
            <p className="mt-1 text-gray-400 text-xs">
              Locally visible {formatTimeRange(eclipse.visibleStart, eclipse.visibleEnd, timezone)}{' '}
              · up to {eclipse.maxAltitude.toFixed(0)}° high
            </p>
          ) : (
            <p className="mt-1 text-gray-500 text-xs">
              The Moon remains below your local horizon during the eclipse.
            </p>
          )}
          <p className="mt-1 text-gray-500 text-xs">
            Meter shows the global maximum fraction of the Moon inside Earth’s umbra.
          </p>
        </div>
      </div>

      <EclipseTimeline
        start={timelineStart}
        peak={eclipse.peakTime}
        end={timelineEnd}
        timezone={timezone}
        labels={['Global start', 'Global max', 'Global end']}
      />
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
          {formatDate(time, timezone)} at {formatTime(time, timezone)}
        </span>
        {details && <span className="text-gray-500 text-xs">{details}</span>}
      </div>
    </div>
  );
}
