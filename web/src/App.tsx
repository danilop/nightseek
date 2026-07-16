import { useCallback, useEffect, useRef } from 'react';
import ForecastView from './components/forecast/ForecastView';
import Header from './components/layout/Header';
import OnboardingWizard from './components/setup/OnboardingWizard';
import ErrorBoundary from './components/ui/ErrorBoundary';
import ErrorMessage from './components/ui/ErrorMessage';
import LoadingScreen from './components/ui/LoadingScreen';
import OfflineBanner from './components/ui/OfflineBanner';
import { generateForecast } from './lib/analyzer';
import { CACHE_KEYS, setCache } from './lib/utils/cache';
import { logger } from './lib/utils/logger';
import { useApp } from './stores/AppContext';

export default function App() {
  const { state, dispatch, setProgress } = useApp();
  const { location, settings, forecasts, isLoading, error, isOffline, isSetupComplete } = state;
  const activeForecastKeyRef = useRef<string | null>(null);
  const forecastRequestIdRef = useRef(0);
  const lastForecastLoadedAtRef = useRef<number | null>(null);

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: coordinates superseding async forecast requests and stale-result guards
  const loadForecast = useCallback(async () => {
    if (!location) return;

    const forecastKey = `${location.latitude},${location.longitude}|${JSON.stringify(settings)}`;
    if (activeForecastKeyRef.current === forecastKey) return;

    const requestId = ++forecastRequestIdRef.current;
    activeForecastKeyRef.current = forecastKey;

    dispatch({
      type: 'SET_LOADING',
      payload: { isLoading: true, message: 'Starting...', percent: 0 },
    });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const result = await generateForecast(location, settings, (message, percent) => {
        if (forecastRequestIdRef.current === requestId) setProgress(message, percent);
      });

      if (forecastRequestIdRef.current !== requestId) return;

      // Show 100% complete briefly before hiding loading screen
      setProgress('Complete!', 100);
      await new Promise(resolve => setTimeout(resolve, 300));
      if (forecastRequestIdRef.current !== requestId) return;

      // Backfill location timezone from Open-Meteo response. Dispatch it in the
      // same turn as the matching forecast so observers never see mixed locations.
      if (result.timezone && location.timezone !== result.timezone) {
        const updated = { ...location, timezone: result.timezone };
        dispatch({ type: 'SET_LOCATION', payload: updated });
        void setCache(CACHE_KEYS.LOCATION, updated);
      }

      dispatch({
        type: 'SET_FORECAST',
        payload: {
          forecasts: result.forecasts,
          scoredObjects: result.scoredObjects,
          bestNights: result.bestNights,
        },
      });
      lastForecastLoadedAtRef.current = Date.now();
    } catch (err) {
      if (forecastRequestIdRef.current !== requestId) return;
      logger.error('Forecast generation failed', err);
      dispatch({
        type: 'SET_ERROR',
        payload: err instanceof Error ? err.message : 'Failed to generate forecast',
      });
    } finally {
      if (forecastRequestIdRef.current === requestId) {
        activeForecastKeyRef.current = null;
        dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
      }
    }
  }, [location, settings, dispatch, setProgress]);

  // A new location/settings key supersedes any in-flight calculation. Stale
  // requests are ignored, while the replacement starts immediately.
  useEffect(() => {
    if (location && !forecasts) void loadForecast();
  }, [location, forecasts, loadForecast]);

  useEffect(() => {
    const staleForecastMs = 20 * 60 * 1000;

    const maybeRefresh = () => {
      if (document.visibilityState === 'hidden') return;
      if (!location || !forecasts || isLoading || error) return;

      const lastLoadedAt = lastForecastLoadedAtRef.current;
      if (lastLoadedAt !== null && Date.now() - lastLoadedAt < staleForecastMs) return;

      void loadForecast();
    };

    window.addEventListener('focus', maybeRefresh);
    document.addEventListener('visibilitychange', maybeRefresh);

    return () => {
      window.removeEventListener('focus', maybeRefresh);
      document.removeEventListener('visibilitychange', maybeRefresh);
    };
  }, [location, forecasts, isLoading, error, loadForecast]);

  // Show setup if no location
  if (!isSetupComplete || !location) {
    return (
      <div className="min-h-screen bg-night-950">
        <Header />
        {isOffline && <OfflineBanner />}
        <OnboardingWizard />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-night-950">
      <Header />
      {isOffline && <OfflineBanner />}

      {isLoading && <LoadingScreen message={state.loadingMessage} percent={state.loadingPercent} />}

      {error && (
        <div className="container mx-auto px-4 py-8">
          <ErrorMessage message={error} onRetry={loadForecast} />
        </div>
      )}

      {!isLoading && !error && forecasts && (
        <ErrorBoundary>
          <ForecastView
            key={`${location.latitude},${location.longitude}`}
            forecasts={forecasts}
            scoredObjects={state.scoredObjects}
            bestNights={state.bestNights}
            location={location}
            onRefresh={loadForecast}
          />
        </ErrorBoundary>
      )}
    </div>
  );
}
