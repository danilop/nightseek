import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { preloadLightPollutionGrid } from './lib/lightpollution';
import { cleanupOldCaches } from './lib/utils/cache';
import { AppProvider } from './stores/AppContext';
import './index.css';

// Clean up old versioned caches on app startup
cleanupOldCaches();

// Handle stale-chunk errors after a deploy: Vite fires this when a preloaded
// module 404s because chunk hashes changed.  We reload once per session to
// pick up the new index.html; the sessionStorage guard prevents infinite loops.
window.addEventListener('vite:preloadError', event => {
  const key = 'vite_chunk_reloaded';
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, '1');
    (event as Event).preventDefault();
    window.location.reload();
    return;
  }
  sessionStorage.removeItem(key);
});
// If we got here the app loaded successfully — reset the guard for next deploy
sessionStorage.removeItem('vite_chunk_reloaded');

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
