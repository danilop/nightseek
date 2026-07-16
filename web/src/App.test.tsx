import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Location } from '@/types';
import App from './App';
import type { ForecastResult } from './lib/analyzer';

interface MockContext {
  state: ReturnType<typeof buildState>;
  dispatch: ReturnType<typeof vi.fn>;
  setProgress: ReturnType<typeof vi.fn>;
}

interface DispatchedAction {
  type: string;
  payload?: { forecasts?: ForecastResult['forecasts'] };
}

const mocks = vi.hoisted(() => ({
  generateForecast: vi.fn(),
  setCache: vi.fn(),
  dispatch: vi.fn(),
  setProgress: vi.fn(),
  context: null as unknown as MockContext,
}));

vi.mock('./lib/analyzer', () => ({ generateForecast: mocks.generateForecast }));
vi.mock('./lib/utils/cache', () => ({
  CACHE_KEYS: { LOCATION: 'nightseek:location' },
  setCache: mocks.setCache,
}));
vi.mock('./stores/AppContext', () => ({ useApp: () => mocks.context }));
vi.mock('./components/forecast/ForecastView', () => ({ default: () => null }));
vi.mock('./components/layout/Header', () => ({ default: () => null }));
vi.mock('./components/setup/OnboardingWizard', () => ({ default: () => null }));
vi.mock('./components/ui/ErrorBoundary', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('./components/ui/ErrorMessage', () => ({ default: () => null }));
vi.mock('./components/ui/LoadingScreen', () => ({ default: () => null }));
vi.mock('./components/ui/OfflineBanner', () => ({ default: () => null }));

function buildState(location: Location) {
  return {
    location,
    settings: {
      forecastDays: 2,
      maxObjects: 8,
      cometMagnitude: 12,
      dsoMagnitude: 16,
      theme: 'dark' as const,
      units: {
        temperature: 'celsius' as const,
        speed: 'kmh' as const,
        pressure: 'hpa' as const,
        distance: 'km' as const,
      },
      showSatellitePasses: true,
      telescope: 'generic' as const,
      customFOV: null,
    },
    forecasts: null,
    scoredObjects: null,
    bestNights: [],
    isLoading: false,
    loadingMessage: '',
    loadingPercent: 0,
    error: null,
    isOffline: false,
    isSetupComplete: true,
  };
}

function buildContext(location: Location): MockContext {
  return {
    state: buildState(location),
    dispatch: mocks.dispatch,
    setProgress: mocks.setProgress,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolvePromise => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function forecastResult(id: string): ForecastResult {
  return {
    forecasts: [{ id }] as unknown as ForecastResult['forecasts'],
    scoredObjects: new Map(),
    bestNights: [],
    timezone: 'UTC',
  };
}

describe('App forecast invalidation', () => {
  beforeEach(() => {
    mocks.generateForecast.mockReset();
    mocks.dispatch.mockReset();
    mocks.setProgress.mockReset();
    mocks.setCache.mockReset();
  });

  afterEach(() => vi.restoreAllMocks());

  it('starts the new location immediately and ignores the stale location result', async () => {
    const london = deferred<ForecastResult>();
    const newYork = deferred<ForecastResult>();
    mocks.generateForecast.mockImplementation((location: Location) =>
      location.name === 'London' ? london.promise : newYork.promise
    );
    mocks.context = buildContext({
      name: 'London',
      latitude: 51.5074,
      longitude: -0.1278,
      timezone: 'Europe/London',
    });

    const rendered = render(<App />);
    await waitFor(() => expect(mocks.generateForecast).toHaveBeenCalledTimes(1));

    mocks.context = buildContext({
      name: 'New York',
      latitude: 40.7128,
      longitude: -74.006,
      timezone: 'America/New_York',
    });
    rendered.rerender(<App />);
    await waitFor(() => expect(mocks.generateForecast).toHaveBeenCalledTimes(2));

    newYork.resolve(forecastResult('new-york'));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 310));
    });
    london.resolve(forecastResult('london'));
    await act(async () => {
      await Promise.resolve();
    });

    const forecastActions = mocks.dispatch.mock.calls
      .map(([action]) => action as DispatchedAction)
      .filter(action => action.type === 'SET_FORECAST');
    expect(forecastActions).toHaveLength(1);
    expect(forecastActions[0].payload?.forecasts).toEqual([{ id: 'new-york' }]);
  });
});
