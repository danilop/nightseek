import { type ReactNode, useEffect } from 'react';
import { AppProvider as SharedAppProvider, useApp } from '@/stores/AppContext.shared';
import { scheduleNotificationsFromForecast } from '../lib/notifications/scheduler';

export { useApp } from '@/stores/AppContext.shared';

function resetNativePreferences() {
  localStorage.removeItem('nightseek:notification-prefs');
}

function ForecastNotifications() {
  const { state } = useApp();
  useEffect(() => {
    if (!state.isLoading && state.forecasts && state.scoredObjects && state.location) {
      void scheduleNotificationsFromForecast(state.forecasts, state.scoredObjects, state.location);
    }
  }, [state.forecasts, state.scoredObjects, state.isLoading, state.location]);
  return null;
}

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <SharedAppProvider onReset={resetNativePreferences}>
      <ForecastNotifications />
      {children}
    </SharedAppProvider>
  );
}
