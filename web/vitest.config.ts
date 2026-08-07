import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

// Merged with the app config so tests resolve modules exactly like production
// does — in particular the `satellite.js` browser shim alias.
export default mergeConfig(
  viteConfig,
  defineConfig({
    // The PWA plugin has nothing to do under test and slows every run down.
    plugins: [],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      exclude: ['node_modules', 'dist', 'e2e'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html', 'lcov'],
        reportsDirectory: './coverage',
        exclude: [
          'node_modules/',
          'src/test/',
          '**/*.d.ts',
          '**/*.config.*',
          '**/types/**',
          'src/main.tsx',
          'src/vite-env.d.ts',
        ],
        thresholds: {
          lines: 70,
          functions: 70,
          branches: 60,
          statements: 70,
        },
      },
      testTimeout: 10000,
      hookTimeout: 10000,
      pool: 'forks',
      isolate: false,
    },
  })
);
