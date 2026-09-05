import { useEffect, type ReactNode } from 'react';
import { AppProvider as SharedAppProvider, useApp } from '@/stores/AppContext.shared';
import { scheduleNotificationsFromForecast } from '../lib/notifications/scheduler';

export { useApp } from '@/stores/AppContext.shared';

function resetNativePreferences() {
  localStorage.removeItem('nightseek:notification-prefs');
}

function ForecastNotifications() {
  const { state } = useApp();
  useEffect(() => {
    if (!state.isLoading && state.forecasts && state.scoredObjects) {
      void scheduleNotificationsFromForecast(state.forecasts, state.scoredObjects);
    }
  }, [state.forecasts, state.scoredObjects, state.isLoading]);
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
