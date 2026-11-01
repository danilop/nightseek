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
import type { ReactNode } from 'react';
import ExplainSection from '@/components/ui/ExplainSection';
import { describeLunarApsis } from '@/lib/astronomy/lunar-apsis';
import { getEclipseSeasonDescription } from '@/lib/astronomy/lunar-nodes';
import { getMoonPhaseEmoji, getMoonPhaseName } from '@/lib/astronomy/moon-phases';
import { getPlanetApsisDescription } from '@/lib/astronomy/planet-apsis';
import { getVenusPeakDescription } from '@/lib/astronomy/venus-peak';
import { describeLunarEclipse, describeSolarEclipse } from '@/lib/events/eclipses';
import { describeSeasonalMarker, getSeasonalMarkerName } from '@/lib/events/seasons';
import { getTransitAlertSummary } from '@/lib/events/transits';
import { formatDate, formatTime, formatTimeRange } from '@/lib/utils/format';
import { useApp } from '@/stores/AppContext';
import type { AstronomicalEvents, Conjunction, LunarEclipse, SolarEclipse } from '@/types';
import AngularSeparationDiagram from './AngularSeparationDiagram';
import CloseApproachCard from './CloseApproachCard';
import SpaceWeatherCard from './SpaceWeatherCard';

interface AstronomicalEventsSectionProps {
  events?: AstronomicalEvents;
  conjunctions?: Conjunction[];
  nightDate: Date;
}

export default function AstronomicalEventsSection({
  events,
  conjunctions = [],
  nightDate,
}: AstronomicalEventsSectionProps) {
  const { state } = useApp();
  const timezone = state.location?.timezone;
  const entries: Array<{ id: string; time: Date; content: ReactNode }> = [];
  const add = (id: string, props: EventCardProps) =>
    entries.push({ id, time: props.time, content: <EventCard {...props} /> });
  if (events?.lunarEclipse)
    entries.push({
      id: 'lunar-eclipse',
      time: events.lunarEclipse.peakTime,
      content: <LunarEclipseCard eclipse={events.lunarEclipse} />,
    });
  if (events?.solarEclipse)
    entries.push({
      id: 'solar-eclipse',
      time: events.solarEclipse.peakTime,
      content: <SolarEclipseCard eclipse={events.solarEclipse} />,
    });
  if (events?.lunarApsis?.isSupermoon)
    add('supermoon', {
      icon: <Moon className="h-4 w-4" />,
      title: 'Supermoon',
      description: describeLunarApsis(events.lunarApsis),
      time: events.lunarApsis.date,
    });
  for (const opposition of events?.oppositions.filter(o => o.isActive) ?? [])
    add(`opposition-${opposition.planet}`, {
      icon: <Target className="h-4 w-4" />,
      title: `${opposition.planet} at opposition`,
      description:
        'The planet is opposite the Sun in the sky. Check its local altitude before observing.',
      time: opposition.date,
      isHighlight: Math.abs(opposition.daysUntil) <= 3,
    });
  for (const elongation of events?.maxElongations.filter(e => Math.abs(e.daysUntil) <= 3) ?? [])
    add(`elongation-${elongation.planet}`, {
      icon: <CircleDot className="h-4 w-4" />,
      title: `${elongation.planet} maximum elongation`,
      description: `${elongation.elongationDeg.toFixed(1)}° ${elongation.isEastern ? 'east' : 'west'} of the Sun`,
      time: elongation.date,
      details: elongation.isEastern ? 'Evening sky' : 'Morning sky',
    });
  if (events?.seasonalMarker && events.seasonalMarker.daysUntil <= 1)
    add('season', {
      icon: <Sun className="h-4 w-4" />,
      title: getSeasonalMarkerName(events.seasonalMarker.type),
      description: describeSeasonalMarker(events.seasonalMarker),
      time: events.seasonalMarker.time,
    });
  if (events?.moonPhaseEvent)
    add('moon-phase', {
      icon: <span>{getMoonPhaseEmoji(events.moonPhaseEvent.phase)}</span>,
      title: getMoonPhaseName(events.moonPhaseEvent.phase),
      description: 'Exact lunar phase. The time is shown in your observing location’s timezone.',
      time: events.moonPhaseEvent.time,
    });
  if (events?.eclipseSeason?.isActive)
    add('eclipse-season', {
      icon: <AlertTriangle className="h-4 w-4" />,
      title: 'Eclipse season',
      description: getEclipseSeasonDescription(events.eclipseSeason, nightDate, timezone),
      time: events.eclipseSeason.nodeCrossingTime,
    });
  if (events?.venusPeak?.isNearPeak)
    add('venus', {
      icon: <Star className="h-4 w-4" />,
      title: 'Venus at peak brightness',
      description: getVenusPeakDescription(events.venusPeak),
      time: events.venusPeak.peakDate,
    });
  for (const apsis of events?.planetPerihelia ?? [])
    add(`perihelion-${apsis.planet}`, {
      icon: <Sparkles className="h-4 w-4" />,
      title: `${apsis.planet} near perihelion`,
      description: getPlanetApsisDescription(apsis),
      time: apsis.date,
    });
  if (events?.planetaryTransit && events.planetaryTransit.yearsUntil <= 2)
    add('transit', {
      icon: <Sun className="h-4 w-4" />,
      title: `${events.planetaryTransit.planet} transit`,
      description: getTransitAlertSummary(events.planetaryTransit),
      time: events.planetaryTransit.peak,
    });
  for (const conjunction of conjunctions)
    add(
      `conjunction-${conjunction.object1Name}-${conjunction.object2Name}-${Number(conjunction.time)}`,
      {
        icon: <CircleDot className="h-4 w-4" />,
        title: `${conjunction.object1Name} – ${conjunction.object2Name}`,
        description: conjunction.description,
        time: conjunction.time,
        details: `${conjunction.separationDegrees.toFixed(1)}° separation · local visibility not assessed`,
        visual: (
          <AngularSeparationDiagram
            degrees={conjunction.separationDegrees}
            first={conjunction.object1Name}
            second={conjunction.object2Name}
          />
        ),
      }
    );
  entries.sort((a, b) => Number(a.time) - Number(b.time));
  return (
    <div className="space-y-4">
      {entries.length > 0 && (
        <section
          className="rounded-xl border border-night-700 bg-night-900 p-4"
          aria-label="Event agenda"
        >
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-white">
            <Calendar className="h-4 w-4 text-sky-300" />
            Event agenda
          </h3>
          <ol className="space-y-3">
            {entries.map(entry => (
              <li key={entry.id} data-event-time={entry.time.toISOString()}>
                {entry.content}
              </li>
            ))}
          </ol>
        </section>
      )}
      {!!events?.neoCloseApproaches?.length && (
        <CloseApproachCard approaches={events.neoCloseApproaches} nightDate={nightDate} />
      )}
      {events?.spaceWeather && (
        <SpaceWeatherCard
          spaceWeather={events.spaceWeather}
          auroraForecast={events.auroraForecast}
        />
      )}
    </div>
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
  visual?: ReactNode;
}

function EventCard({
  icon,
  title,
  description,
  time,
  isHighlight = false,
  details,
  visual,
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
      <time dateTime={time.toISOString()} className="block text-sky-200 text-sm">
        {formatDate(time, timezone)} · {formatTime(time, timezone)}
      </time>
      {details && <p className="mt-1 text-gray-400 text-xs">{details}</p>}
      <ExplainSection title={`About ${title}`} className="mt-2">
        {visual}
        <p>{description}</p>
      </ExplainSection>
    </div>
  );
}
