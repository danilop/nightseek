import { formatInTimeZone } from 'date-fns-tz';
import { useEffect, useMemo, useRef, useState } from 'react';
import { type FieldBody, fetchSkybot } from '@/lib/catalogs/skybot';
import { resolveLocalMinute } from '@/lib/utils/local-time';
import type { ScoredObject } from '@/types';

type Galaxy = typeof import('@/data/ned-galaxies.json')['galaxies'][number];
function normalize(name: string) {
  return name
    .toLowerCase()
    .replace(/messier/g, 'm')
    .replace(/[^a-z0-9]/g, '')
    .replace(/([a-z])0+(\d)/g, '$1$2');
}
export default function TargetReferencePanel({
  object,
  width,
  height,
  time,
  timezone,
}: {
  object: ScoredObject;
  width: number;
  height: number;
  time: Date;
  timezone?: string;
}) {
  const requestId = useRef(0);
  useEffect(
    () => () => {
      requestId.current++;
    },
    []
  );
  const [galaxy, setGalaxy] = useState<Galaxy | null>(null);
  const [referenceReady, setReferenceReady] = useState(false);
  const [bodies, setBodies] = useState<FieldBody[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'failed'>('idle');
  const tz = timezone ?? 'UTC';
  const [epoch, setEpoch] = useState(formatInTimeZone(time, tz, "yyyy-MM-dd'T'HH:mm"));
  const timeMs = time.getTime();
  const [selectedInstant, setSelectedInstant] = useState(timeMs);
  const instants = useMemo(() => resolveLocalMinute(epoch, tz), [epoch, tz]);
  const matchingInstant = instants.find(
    instant => instant.getTime() === Math.floor(selectedInstant / 60_000) * 60_000
  );
  // Preserve the exact selected instant (including seconds) until the user edits it.
  const exposureTime = matchingInstant ? new Date(selectedInstant) : instants[0];
  useEffect(() => {
    requestId.current++;
    setEpoch(formatInTimeZone(new Date(timeMs), tz, "yyyy-MM-dd'T'HH:mm"));
    setSelectedInstant(timeMs);
    setStatus('idle');
    setBodies(null);
  }, [timeMs, tz]);
  const isGalaxy = object.subtype?.startsWith('galaxy') ?? false;
  const radius = Math.hypot(width, height) / 120;
  useEffect(() => {
    let cancelled = false;
    if (isGalaxy)
      void import('@/data/ned-galaxies.json').then(data => {
        const name = normalize(object.objectName);
        const found =
          data.galaxies.find(g =>
            [g.name, ...g.aliases].some(alias => normalize(alias) === name)
          ) ??
          data.galaxies.find(
            g =>
              g.raDegrees !== null &&
              g.decDegrees !== null &&
              Math.hypot(
                (g.raDegrees - object.visibility.raHours * 15) *
                  Math.cos((object.visibility.decDegrees * Math.PI) / 180),
                g.decDegrees - object.visibility.decDegrees
              ) < 0.02
          ) ??
          null;
        if (!cancelled) {
          setGalaxy(found);
          setReferenceReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isGalaxy, object.objectName, object.visibility.raHours, object.visibility.decDegrees]);
  async function search() {
    if (!exposureTime) return;
    const id = ++requestId.current;
    setStatus('loading');
    setBodies(null);
    const result = await fetchSkybot(
      object.visibility.raHours * 15,
      object.visibility.decDegrees,
      radius,
      exposureTime
    );
    if (id !== requestId.current) return;
    setBodies(result);
    setStatus(result === null ? 'failed' : 'done');
  }
  return (
    <section
      className="space-y-3 rounded-lg border border-night-700 p-3"
      aria-label="Object reference and moving objects"
    >
      {isGalaxy && (
        <GalaxyReference
          galaxy={galaxy}
          referenceReady={referenceReady}
          objectName={object.objectName}
        />
      )}
      <h4 className="font-medium text-white">Moving objects near this frame</h4>
      <ExposureTimeField
        epoch={epoch}
        instants={instants}
        exposureTime={exposureTime}
        timezone={tz}
        onChange={(value, instant) => {
          requestId.current++;
          setEpoch(value);
          setSelectedInstant(instant);
          setStatus('idle');
          setBodies(null);
        }}
      />
      <p className="text-gray-400 text-xs">
        SkyBoT searches the {radius.toFixed(2)}° radius circle enclosing a {width.toFixed(1)}′ ×{' '}
        {height.toFixed(1)}′ field (60′ × 60′ reference field when no equipment is selected).
        Results use geocentric positions; objects near the corners or edge may lie outside the
        rectangular image. No satellite-trail prediction.
      </p>
      <button
        type="button"
        className="min-h-11 rounded bg-sky-600 px-3 text-sm text-white disabled:opacity-50"
        disabled={status === 'loading' || !exposureTime || radius > 10}
        onClick={() => void search()}
      >
        {status === 'loading' ? 'Searching…' : 'Find asteroids and comets'}
      </button>
      {radius > 10 && (
        <p className="text-gray-400 text-xs">
          Choose a smaller field (search radius must be 10° or less).
        </p>
      )}
      {status === 'failed' && (
        <p className="text-amber-300 text-sm">
          SkyBoT is unavailable. Try again later; no result is not evidence of an empty field.
        </p>
      )}
      {bodies && (
        <>
          <p className="text-gray-300 text-sm">
            {bodies.length} object(s) in the search cone
            {bodies.length > 10 ? ' · showing the 10 brightest' : ''}
          </p>
          <ul className="space-y-2 text-sm">
            {bodies.slice(0, 10).map(b => (
              <li key={b.name} className="text-gray-300">
                {b.name} ·{' '}
                {b.magnitude === null
                  ? 'magnitude unknown'
                  : `estimated mag ${b.magnitude.toFixed(1)}`}
                <span className="block text-gray-500 text-xs">
                  {b.ra} / {b.dec} · {b.kind} · motion RA/Dec {b.motionRa?.toFixed(1) ?? '?'} /{' '}
                  {b.motionDec?.toFixed(1) ?? '?'} arcsec/h
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <a
        className="block text-gray-500 text-xs underline"
        href="https://ssp.imcce.fr/webservices/skybot/"
        target="_blank"
        rel="noreferrer"
      >
        IMCCE / Observatoire de Paris SkyBoT
      </a>
    </section>
  );
}

function ExposureTimeField({
  epoch,
  instants,
  exposureTime,
  timezone,
  onChange,
}: {
  epoch: string;
  instants: Date[];
  exposureTime: Date | undefined;
  timezone: string;
  onChange: (epoch: string, instant: number) => void;
}) {
  return (
    <>
      <label className="block text-gray-400 text-xs">
        Exposure time ({timezone})
        <input
          className="mt-1 block w-full rounded bg-night-800 p-2 text-white"
          type="datetime-local"
          value={epoch}
          onChange={event => onChange(event.target.value, Number.NaN)}
        />
      </label>
      {instants.length > 1 && (
        <label className="block text-gray-400 text-xs">
          This time occurs twice. Choose the exposure's occurrence:
          <select
            aria-label="Exposure time occurrence"
            className="mt-1 block w-full rounded bg-night-800 p-2 text-white"
            value={exposureTime ? Math.floor(exposureTime.getTime() / 60_000) * 60_000 : ''}
            onChange={event => onChange(epoch, Number(event.target.value))}
          >
            {instants.map((instant, index) => (
              <option key={instant.getTime()} value={instant.getTime()}>
                {index === 0 ? 'First' : 'Second'} occurrence ·{' '}
                {formatInTimeZone(instant, timezone, "'UTC'xxx")}
              </option>
            ))}
          </select>
        </label>
      )}
      {epoch && instants.length === 0 && (
        <p role="alert" className="text-amber-300 text-sm">
          This local time does not exist because the clocks move forward, or the date is invalid.
          Choose a valid exposure time.
        </p>
      )}
    </>
  );
}

function GalaxyReference({
  galaxy,
  referenceReady,
  objectName,
}: {
  galaxy: Galaxy | null;
  referenceReady: boolean;
  objectName: string;
}) {
  return (
    <div className="space-y-1 text-sm">
      <h4 className="font-medium text-white">Galaxy reference · NASA/IPAC NED</h4>
      {galaxy ? (
        <>
          <p className="text-purple-200">
            Distance{' '}
            {galaxy.distanceMpc === null
              ? 'unavailable'
              : `${(galaxy.distanceMpc * 3.26156).toFixed(2)} million light-years`}
            {galaxy.distanceSemMpc !== null &&
              ` (mean SEM ±${(galaxy.distanceSemMpc * 3.26156).toFixed(3)} million ly)`}
          </p>
          <p className="text-gray-400 text-xs">
            {galaxy.distanceMethod}. Values combine published measurements, not a foreground-star
            parallax.
          </p>
          <p className="text-gray-300">
            Morphology {galaxy.morphology ?? 'unknown'} · redshift {galaxy.redshift ?? 'unknown'}
          </p>
          {galaxy.diameterArcsec !== null && (
            <p className="text-gray-400 text-xs">
              Catalogue diameter {(galaxy.diameterArcsec / 60).toFixed(1)}′ ({galaxy.diameterBand});
              different bands can give different sizes.
            </p>
          )}
          <p className="text-gray-500 text-xs">
            Snapshot {new Date(galaxy.fetchedAt).toLocaleDateString()} · morphology reference{' '}
            {galaxy.morphologyReference ?? 'not supplied'}
          </p>
        </>
      ) : (
        <p className="text-gray-400">
          {referenceReady
            ? 'No bundled distance for this galaxy. Open NED for the source catalogue.'
            : 'Loading galaxy reference…'}
        </p>
      )}
      <a
        className="inline-block min-h-11 text-sky-300"
        href={`https://ned.ipac.caltech.edu/byname?objname=${encodeURIComponent(objectName)}`}
        target="_blank"
        rel="noreferrer"
      >
        Open NED object reference ↗
      </a>
    </div>
  );
}
