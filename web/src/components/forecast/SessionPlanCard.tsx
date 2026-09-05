import { ArrowUpRight, Bookmark, CalendarPlus, Telescope } from 'lucide-react';
import { useMemo } from 'react';
import { useCurrentTime } from '@/hooks/useCurrentTime';
import { useWatchlist } from '@/hooks/useWatchlist';
import { createSessionCalendar, downloadSessionCalendar } from '@/lib/planning/calendar';
import { planSessionTargets } from '@/lib/planning/session';
import { formatDurationMinutes, formatTimeRange } from '@/lib/utils/format';
import type { TargetAccessibility } from '@/lib/utils/horizon-profile';
import type { HorizonProfile, Location, NightForecast, ScoredObject } from '@/types';

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
  const { saved, toggle } = useWatchlist();
  const candidates = useMemo(
    () => (isReady ? planSessionTargets(objects, profile, forecast.weather, now) : []),
    [objects, profile, forecast.weather, now, isReady]
  );
  const picks = candidates.slice(0, 3);
  const savedCandidates = candidates.filter(candidate =>
    saved.includes(candidate.object.objectName)
  );
  const candidateIds = new Set(savedCandidates.map(candidate => candidate.object.objectName));
  const unavailable = saved.filter(id => !candidateIds.has(id));
  const hasWeather = forecast.weather !== null;

  return (
    <section
      aria-labelledby="session-heading"
      className="relative overflow-hidden rounded-2xl border border-sky-300/20 bg-gradient-to-br from-sky-950/60 via-night-900 to-night-900 p-5 sm:p-6"
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-2 flex items-center gap-2 font-medium text-sky-300 text-xs uppercase tracking-widest">
            <Telescope className="h-4 w-4" /> Your next session
          </p>
          <h3 id="session-heading" className="font-semibold text-2xl text-white tracking-tight">
            Choose your next target.
          </h3>
          <p className="mt-2 max-w-xl text-gray-400 text-sm">
            {hasWeather
              ? 'Deep-sky choices for your telescope and your patch of sky.'
              : 'Visibility-based ideas. Weather is unavailable; check conditions before setting up.'}
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
      <div className="grid snap-x snap-mandatory auto-cols-[88%] grid-flow-col gap-3 overflow-x-auto pb-2 md:auto-cols-auto md:grid-flow-row md:grid-cols-3">
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
                <h4 className="font-semibold text-lg text-white group-hover:text-sky-200">
                  {name}
                </h4>
                <p className="mt-1 text-gray-400 text-xs">
                  {object.visibility.constellation} · peaks at{' '}
                  {Math.round(object.visibility.maxAltitude)}°
                </p>
                <p className="mt-5 font-medium text-sky-100 text-sm tabular-nums">
                  {formatTimeRange(window.start, window.end, location.timezone)}
                </p>
                <p className="mt-1 text-gray-400 text-xs">
                  {formatDurationMinutes(window.durationMinutes)} above your horizon ·{' '}
                  {hasWeather ? `${window.quality} conditions estimate` : 'weather unknown'}
                </p>
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
      {picks.length > 1 && (
        <p className="mt-2 text-gray-400 text-xs md:hidden">
          Swipe to compare {picks.length} targets
        </p>
      )}
      {picks.length === 0 && (
        <p className="rounded-xl bg-night-950/40 p-4 text-gray-300 text-sm">
          {isReady
            ? 'No remaining deep-sky imaging window meets your current horizon and conditions. Explore targets or choose another night.'
            : 'Loading your saved horizon…'}
        </p>
      )}
      <div className="mt-5 border-white/10 border-t pt-4">
        <p className="mb-2 font-medium text-gray-300 text-xs">
          Your watchlist <span className="font-normal text-gray-500">· saved on this device</span>
        </p>
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
                {object.visibility.commonName || object.objectName} ·{' '}
                {formatDurationMinutes(window.durationMinutes)} available
              </button>
            ))}
            {unavailable.map(id => (
              <button
                type="button"
                key={id}
                onClick={() => toggle(id)}
                aria-label={`Remove ${id} from watchlist`}
                className="min-h-11 rounded-lg bg-white/5 px-3 py-2 text-gray-400 text-xs"
              >
                {id} · no window · remove
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
