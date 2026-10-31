import { useEffect, useState } from 'react';
import { formatTimeRange } from '@/lib/utils/format';
import { type EnsembleForecast, ensembleWindow, fetchEnsemble } from '@/lib/weather/ensemble';
import { fetchMetNorway, type ModelForecast } from '@/lib/weather/met-norway';
import { weatherCoverage } from '@/lib/weather/observing-conditions';
import type { Location, NightForecast, NightInfo, NightWeather } from '@/types';

export default function ForecastEvidenceCard({
  forecast,
  location,
}: {
  forecast: NightForecast;
  location: Location;
}) {
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<{
    ensemble: EnsembleForecast | null;
    met: ModelForecast | null;
  } | null>(null);
  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    setData(null);
    void Promise.all([
      fetchEnsemble(location.latitude, location.longitude),
      fetchMetNorway(location.latitude, location.longitude),
    ]).then(([ensemble, met]) => {
      if (!cancelled) setData({ ensemble, met });
    });
    return () => {
      cancelled = true;
    };
  }, [expanded, location.latitude, location.longitude]);
  const { nightInfo: night, weather } = forecast;
  const coverage = weather ? weatherCoverage(weather, night) : null;
  return (
    <section
      className="rounded-xl border border-white/10 bg-night-900 p-4"
      aria-label="Forecast evidence"
    >
      <h3 className="font-semibold text-white">How much can we rely on this night?</h3>
      <p className="mt-2 text-gray-300 text-sm">
        {coverage
          ? `${coverage.weather}/${coverage.expected} weather hours · ${coverage.aerosol}/${coverage.expected} aerosol hours · ${coverage.precipitation}/${coverage.expected} rain hours · ${coverage.wind}/${coverage.expected} gust hours · ${coverage.visibility}/${coverage.expected} visibility hours`
          : 'Weather unavailable — astronomy only'}
      </p>
      {weather?.fetchedAt && (
        <p className="mt-1 text-gray-500 text-xs">
          {weather.source} · fetched{' '}
          {new Date(weather.fetchedAt).toLocaleString(undefined, { timeZone: location.timezone })}.
          Model estimates, not measurements.
        </p>
      )}
      <p className="mt-1 text-gray-400 text-xs">
        {forecast.forecastConfidence === 'high'
          ? 'Complete near-term inputs'
          : 'Partial inputs or longer forecast lead time'}{' '}
        · completeness does not guarantee accuracy.
      </p>
      <EquipmentSummary weather={weather} />
      <button
        type="button"
        className="mt-3 min-h-11 text-sky-300 text-sm"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? 'Hide forecast comparison' : 'Compare free weather forecasts'}
      </button>
      {expanded && (
        <ForecastComparison data={data} night={night} weather={weather} location={location} />
      )}
    </section>
  );
}

function EquipmentSummary({ weather }: { weather: NightWeather | null }) {
  const hours = weather ? [...weather.hourlyData.values()] : [];
  const direction = hours.find(h => h.windDirection != null)?.windDirection;
  const jet = hours.flatMap(h => (h.jetStreamSpeed == null ? [] : [h.jetStreamSpeed]));
  const fog = hours.flatMap(h => (h.fogCover == null ? [] : [h.fogCover]));
  return (
    <>
      {weather && (
        <p className="mt-2 text-gray-300 text-sm">
          Rain{' '}
          {weather.totalPrecipitationMm === null
            ? 'unknown'
            : `${weather.totalPrecipitationMm.toFixed(1)} mm`}{' '}
          · peak wind/gust{' '}
          {weather.maxWindSpeedKmh === null
            ? 'unknown'
            : `${Math.round(weather.maxWindSpeedKmh)} km/h`}{' '}
          · dew margin{' '}
          {weather.minDewMargin === null ? 'unknown' : `${weather.minDewMargin.toFixed(1)}°C`}
        </p>
      )}
      {direction != null && (
        <p className="mt-1 text-gray-400 text-xs">
          Wind from {Math.round(direction)}° at the first available night hour (0° north, 90° east).
        </p>
      )}
      {fog.length > 0 && (
        <p className="mt-1 text-gray-400 text-xs">
          Near-surface fog/cloud: up to {Math.round(Math.max(...fog))}% (UKMO).
        </p>
      )}
      {jet.length > 0 && (
        <p className="mt-1 text-gray-400 text-xs">
          250 hPa wind: up to {Math.round(Math.max(...jet))} km/h. Jet-stream context, not measured
          seeing.
        </p>
      )}
    </>
  );
}

function EnsembleSummary({
  ensemble,
  night,
  timezone,
}: {
  ensemble: EnsembleForecast | null;
  night: NightInfo;
  timezone?: string;
}) {
  const window = ensemble ? ensembleWindow(ensemble, night) : null;
  if (!window)
    return (
      <p className="text-gray-300">
        Ensemble coverage unavailable for a complete two-hour interval.
      </p>
    );
  return (
    <>
      <p className="text-gray-300">
        {window.support}/{window.members} ICON members support{' '}
        {window.gustsAssessed ? 'clear, dry, low-gust' : 'clear, dry'} conditions during{' '}
        {formatTimeRange(new Date(window.start), new Date(window.end), timezone)}.
      </p>
      <p className="text-gray-400 text-xs">
        Middle 80% cloud range: {Math.round(window.cloudLow)}–{Math.round(window.cloudHigh)}%.
        Member agreement is not a calibrated probability. Thresholds: cloud &lt;30%, rain &lt;0.1
        mm/h{window.gustsAssessed ? ', gusts <40 km/h.' : '.'}
      </p>
      {!window.gustsAssessed && (
        <p className="text-amber-300 text-xs">
          Wind not assessed in this ensemble comparison: complete gust data for {window.gustMembers}
          /{window.members} members. Check the main wind forecast before setting up equipment.
        </p>
      )}
    </>
  );
}

function ForecastComparison({
  data,
  night,
  weather,
  location,
}: {
  data: { ensemble: EnsembleForecast | null; met: ModelForecast | null } | null;
  night: NightInfo;
  weather: NightWeather | null;
  location: Location;
}) {
  const pairs =
    data?.met?.hours.flatMap(h => {
      const primary = weather?.hourlyData.get(h.time);
      return primary && h.cloud !== null ? [{ primary: primary.cloudCover, other: h.cloud }] : [];
    }) ?? [];
  const disagreement = pairs.length
    ? pairs.reduce((sum, p) => sum + Math.abs(p.primary - p.other), 0) / pairs.length
    : null;
  return (
    <div className="space-y-2 border-white/10 border-t pt-3 text-sm">
      {data ? (
        <>
          <EnsembleSummary ensemble={data.ensemble} night={night} timezone={location.timezone} />
          <p className="text-gray-300">
            {disagreement === null
              ? 'MET Norway comparison unavailable.'
              : `MET Norway differs by ${Math.round(disagreement)} percentage points of cloud on average across ${pairs.length} matching hours.${disagreement > 30 ? ' Models disagree substantially — check again before travelling.' : ''}`}
          </p>
          {data.met && (
            <p className="text-gray-500 text-xs">
              MET Norway model updated{' '}
              {new Date(data.met.updatedAt).toLocaleString(undefined, {
                timeZone: location.timezone,
              })}
            </p>
          )}
          <p className="text-gray-500 text-xs">
            Sources:{' '}
            <a
              className="underline"
              href="https://open-meteo.com/en/docs/ensemble-api"
              target="_blank"
              rel="noreferrer"
            >
              Open-Meteo / DWD ICON
            </a>{' '}
            ·{' '}
            <a className="underline" href="https://api.met.no/" target="_blank" rel="noreferrer">
              MET Norway
            </a>
            . Optional feeds are cached for one hour.
          </p>
        </>
      ) : (
        <p className="text-gray-400">Checking ICON ensemble and MET Norway…</p>
      )}
    </div>
  );
}
