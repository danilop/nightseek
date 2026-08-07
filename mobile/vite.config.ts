import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'satellite.js': new URL('./src/lib/satellites/satellite-js-browser.ts', import.meta.url)
        .pathname,
      // Native overrides (specific paths BEFORE the catch-all).
      //
      // These only take effect for `@/`-prefixed imports. A file under web/src
      // that reaches one of these modules by relative path ('./SettingsModal')
      // silently bypasses the override and loads the web version instead — for
      // AppContext that means two different React contexts and a crash on boot.
      // Every module listed here must be imported as '@/...' everywhere.
      '@/stores/AppContext': new URL('./src/stores/AppContext.tsx', import.meta.url).pathname,
      '@/lib/geo/location': new URL('./src/lib/geo/location.ts', import.meta.url).pathname,
      '@/hooks/useInstallPrompt': new URL('./src/hooks/useInstallPrompt.ts', import.meta.url).pathname,
      '@/components/layout/SettingsModal': new URL('./src/components/layout/SettingsModal.tsx', import.meta.url).pathname,
      '@/components/forecast/SkyChart': new URL('./src/components/forecast/SkyChart.tsx', import.meta.url).pathname,

      // Catch-all: everything else resolves to web/src/
      '@': new URL('../web/src', import.meta.url).pathname,
    },
  },
  build: {
    target: 'esnext',
    minify: 'oxc',
  },
});
