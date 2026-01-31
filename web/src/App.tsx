import { useEffect, useCallback } from 'react';
import { useApp } from './stores/AppContext';
import { generateForecast } from './lib/analyzer';
import Header from './components/layout/Header';
import Setup from './components/setup/Setup';
import ForecastView from './components/forecast/ForecastView';
import LoadingScreen from './components/ui/LoadingScreen';
import ErrorMessage from './components/ui/ErrorMessage';
import OfflineBanner from './components/ui/OfflineBanner';

export default function App() {
  const { state, dispatch, setProgress } = useApp();
  const { location, settings, forecasts, isLoading, error, isOffline, isSetupComplete } = state;

  const loadForecast = useCallback(async () => {
    if (!location) return;

    dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: 'Starting...', percent: 0 } });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const result = await generateForecast(location, settings, (message, percent) => {
        setProgress(message, percent);
      });

      dispatch({
        type: 'SET_FORECAST',
        payload: {
          forecasts: result.forecasts,
          scoredObjects: result.scoredObjects,
          bestNights: result.bestNights,
        },
      });
    } catch (err) {
      console.error('Forecast error:', err);
      dispatch({
        type: 'SET_ERROR',
        payload: err instanceof Error ? err.message : 'Failed to generate forecast',
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
    }
  }, [location, settings, dispatch, setProgress]);

  // Load forecast when location changes (only if not already loading or errored)
  useEffect(() => {
    if (location && !forecasts && !isLoading && !error) {
      loadForecast();
    }
  }, [location, forecasts, isLoading, error, loadForecast]);

  // Show setup if no location
  if (!isSetupComplete || !location) {
    return (
      <div className="min-h-screen bg-night-950">
        <Header />
        {isOffline && <OfflineBanner />}
        <Setup />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-night-950">
      <Header />
      {isOffline && <OfflineBanner />}

      {isLoading && (
        <LoadingScreen
          message={state.loadingMessage}
          percent={state.loadingPercent}
        />
      )}

      {error && (
        <div className="container mx-auto px-4 py-8">
          <ErrorMessage
            message={error}
            onRetry={loadForecast}
          />
        </div>
      )}

      {!isLoading && !error && forecasts && (
        <ForecastView
          forecasts={forecasts}
          scoredObjects={state.scoredObjects}
          bestNights={state.bestNights}
          location={location}
          onRefresh={loadForecast}
        />
      )}
    </div>
  );
}
