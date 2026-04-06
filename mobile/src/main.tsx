import React from 'react';
import ReactDOM from 'react-dom/client';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import App from '@/App';
import { preloadLightPollutionGrid } from '@/lib/lightpollution';
import { cleanupOldCaches } from '@/lib/utils/cache';
import { AppProvider } from '@/stores/AppContext';
import '@/index.css';

async function initNativePlugins() {
  try {
    await StatusBar.setStyle({ style: Style.Dark });
  } catch {
    // StatusBar not available (e.g. Mac Catalyst)
  }
}

// Clean up old versioned caches on app startup
cleanupOldCaches();

// Preload the light pollution grid (async, non-blocking)
preloadLightPollutionGrid();

// Initialize native plugins (async, non-blocking)
initNativePlugins();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
);

// Hide splash screen once React has rendered
SplashScreen.hide().catch(() => {
  // SplashScreen not available
});
