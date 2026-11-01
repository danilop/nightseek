import { ArrowUpRight, Bookmark, CalendarPlus, Telescope } from 'lucide-react';
import { useMemo } from 'react';
import ExplainSection from '@/components/ui/ExplainSection';
import FrameFill from '@/components/ui/FrameFill';
import Magnitude from '@/components/ui/Magnitude';
import MagnitudeFilterStatus from '@/components/ui/MagnitudeFilterStatus';
import { useCurrentTime } from '@/hooks/useCurrentTime';
import { useMagnitudeFilter } from '@/hooks/useMagnitudeFilter';
import { useWatchlist } from '@/hooks/useWatchlist';
import { createSessionCalendar, downloadSessionCalendar } from '@/lib/planning/calendar';
import { planSessionTargets } from '@/lib/planning/session';
import { formatDurationMinutes } from '@/lib/utils/format';
import type { TargetAccessibility } from '@/lib/utils/horizon-profile';
import { isMagnitudeEstimate, matchesMagnitudeLimit } from '@/lib/utils/magnitude';
import type { HorizonProfile, Location, NightForecast, ScoredObject } from '@/types';
import TargetSummary from './TargetSummary';

interface Props {
  objects: ScoredObject[];
  forecast: NightForecast;
  location: Location;
  profile: HorizonProfile;
  isReady: boolean;
  onSelect: (object: ScoredObject, access?: TargetAccessibility) => void;
  onBrowse: () => void;
}

export default function SessionPlanCard({
  objects,
  forecast,
  location,
  profile,
  isReady,
  onSelect,
  onBrowse,
}: Props) {
  const now = useCurrentTime();
  const { limit } = useMagnitudeFilter();
  const { saved, toggle } = useWatchlist();
  const candidates = useMemo(
    () =>
      isReady
        ? planSessionTargets(
            objects.filter(object => matchesMagnitudeLimit(object.magnitude, limit)),
            profile,
            forecast.weather,
            now
          )
        : [],
    [objects, profile, forecast.weather, now, isReady, limit]
  );
  const picks = candidates.slice(0, 3);
  const savedCandidates = candidates.filter(candidate =>
    saved.includes(candidate.object.objectName)
  );
  const candidateIds = new Set(savedCandidates.map(candidate => candidate.object.objectName));
  const unavailable = saved.filter(
    id =>
      !candidateIds.has(id) &&
      matchesMagnitudeLimit(objects.find(object => object.objectName === id)?.magnitude, limit)
  );
  const hasWeather = forecast.weather !== null;

  return (
    <section
      aria-labelledby="session-heading"
      className="relative overflow-hidden rounded-2xl border border-sky-300/20 bg-gradient-to-br from-sky-950/60 via-night-900 to-night-900 p-5 sm:p-6"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-2 flex items-center gap-2 font-medium text-sky-300 text-xs uppercase tracking-widest">
            <Telescope className="h-4 w-4" /> Your next session
          </p>
          <h3 id="session-heading" className="font-semibold text-lg text-white tracking-tight">
            Recommended targets
          </h3>
          <p className="mt-2 max-w-xl text-gray-400 text-sm">
            {hasWeather ? null : 'Weather unavailable · visibility only'}
          </p>
        </div>
        <button
          type="button"
          onClick={onBrowse}
          className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-sky-200 text-sm hover:bg-white/5"
        >
          All targets <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>
      <MagnitudeFilterStatus />
      <div className="grid gap-3 xl:grid-cols-3">
        {picks.map(({ object, access, window }, index) => {
          const name = object.visibility.commonName || object.objectName;
          const isSaved = saved.includes(object.objectName);
          return (
            <article
              key={object.objectName}
              className="flex min-w-0 snap-start flex-col rounded-xl border border-white/10 bg-night-950/40 p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-sky-300/70 text-xs">0{index + 1} / DEEP SKY</span>
                <button
                  type="button"
                  onClick={() => toggle(object.objectName)}
                  aria-label={`${isSaved ? 'Unsave' : 'Save'} ${name}`}
                  aria-pressed={isSaved}
                  className="-m-2 flex h-11 w-11 items-center justify-center rounded-lg text-sky-200 hover:bg-white/10"
                >
                  <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-sky-300' : ''}`} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => onSelect(object, access)}
                className="group text-left"
              >
                <TargetSummary
                  name={name}
                  magnitude={object.magnitude}
                  visibility={object.visibility}
                  category={object.category}
                  subtype={object.subtype}
                  totalScore={object.totalScore}
                  accessibility={access}
                  timezone={location.timezone}
                  weatherAvailable={hasWeather}
                />
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadSessionCalendar(
                    createSessionCalendar({
                      name,
                      start: window.start,
                      end: window.end,
                      location: location.name ?? 'Observing site',
                      description: `NightSeek planning window. Recheck weather and your horizon before observing. Target: ${object.objectName}. This is a suggested window, not a telescope command.`,
                    })
                  )
                }
                className="mt-4 inline-flex min-h-11 items-center gap-2 self-start rounded-lg text-gray-300 text-xs hover:text-white"
              >
                <CalendarPlus className="h-4 w-4" /> Add to calendar
              </button>
            </article>
          );
        })}
      </div>
      {picks.length === 0 && (
        <p className="rounded-xl bg-night-950/40 p-4 text-gray-300 text-sm">
          {isReady
            ? 'No remaining deep-sky imaging window meets your current horizon and conditions. Explore targets or choose another night.'
            : 'Loading your saved horizon…'}
        </p>
      )}
      <ExplainSection title="Watchlist" summary={`${saved.length} saved targets`} className="mt-3">
        {saved.length === 0 ? (
          <p className="text-gray-400 text-xs">
            Save a target to see its next opportunity here whenever you return.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {savedCandidates.map(({ object, access, window }) => (
              <button
                type="button"
                key={object.objectName}
                onClick={() => onSelect(object, access)}
                className="min-h-11 rounded-lg bg-sky-400/10 px-3 py-2 text-left text-sky-200 text-xs"
              >
                {object.visibility.commonName || object.objectName}{' '}
                <Magnitude
                  value={object.magnitude}
                  estimated={isMagnitudeEstimate(object.category)}
                  source={object.visibility.magnitudeSource}
                />{' '}
                <FrameFill visibility={object.visibility} category={object.category} /> ·{' '}
                {formatDurationMinutes(window.durationMinutes)} available
              </button>
            ))}
            {unavailable.map(id => {
              const object = objects.find(item => item.objectName === id);
              return (
                <button
                  type="button"
                  key={id}
                  onClick={() => toggle(id)}
                  aria-label={`Remove ${id} from watchlist`}
                  className="min-h-11 rounded-lg bg-white/5 px-3 py-2 text-gray-400 text-xs"
                >
                  {id}{' '}
                  <Magnitude
                    value={object?.magnitude}
                    estimated={object ? isMagnitudeEstimate(object.category) : false}
                    source={object?.visibility.magnitudeSource}
                  />{' '}
                  {object && (
                    <FrameFill visibility={object.visibility} category={object.category} />
                  )}{' '}
                  · no window · remove
                </button>
              );
            })}
          </div>
        )}
      </ExplainSection>
    </section>
  );
}
