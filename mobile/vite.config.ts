import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Native overrides (specific paths BEFORE the catch-all)
      '@/stores/AppContext': path.resolve(__dirname, 'src/stores/AppContext'),
      '@/lib/geo/location': path.resolve(__dirname, 'src/lib/geo/location'),
      '@/hooks/useInstallPrompt': path.resolve(__dirname, 'src/hooks/useInstallPrompt'),
      '@/components/layout/SettingsModal': path.resolve(
        __dirname,
        'src/components/layout/SettingsModal'
      ),
      '@/components/forecast/SkyChart': path.resolve(
        __dirname,
        'src/components/forecast/SkyChart'
      ),

      // Catch-all: everything else resolves to web/src/
      '@': path.resolve(__dirname, '../web/src'),
    },
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
  },
});
