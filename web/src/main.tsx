import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { preloadLightPollutionGrid } from './lib/lightpollution';
import { cleanupOldCaches } from './lib/utils/cache';
import { AppProvider } from './stores/AppContext';
import './index.css';

// Clean up old versioned caches on app startup
cleanupOldCaches();

// Preload the light pollution grid (async, non-blocking)
preloadLightPollutionGrid();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
);
