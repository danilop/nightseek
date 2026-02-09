import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProvider, useApp } from './AppContext';

// Mock IDB cache module
vi.mock('@/lib/utils/cache', () => ({
  CACHE_KEYS: { LOCATION: 'location' },
  getCached: vi.fn().mockResolvedValue(null),
  setCache: vi.fn().mockResolvedValue(undefined),
  clearAllCache: vi.fn().mockResolvedValue(undefined),
}));

// Mock useUIState resetUIState
vi.mock('@/hooks/useUIState', () => ({
  resetUIState: vi.fn(),
}));

function wrapper({ children }: { children: ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}

describe('AppContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('provides initial state', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    const { state } = result.current;

    expect(state.location).toBeNull();
    expect(state.forecasts).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.isSetupComplete).toBe(false);
    expect(state.settings.forecastDays).toBe(7);
    expect(state.settings.maxObjects).toBe(8);
  });

  it('throws when used outside AppProvider', () => {
    expect(() => {
      renderHook(() => useApp());
    }).toThrow('useApp must be used within AppProvider');
  });

  it('SET_LOCATION updates location', () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: 'SET_LOCATION',
        payload: { latitude: 51.5, longitude: -0.1, name: 'London' },
      });
    });

    expect(result.current.state.location).toEqual({
      latitude: 51.5,
      longitude: -0.1,
      name: 'London',
    });
  });

  it('SET_SETTINGS merges settings', () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: 'SET_SETTINGS',
        payload: { forecastDays: 14, maxObjects: 20 },
      });
    });

    expect(result.current.state.settings.forecastDays).toBe(14);
    expect(result.current.state.settings.maxObjects).toBe(20);
    // Other settings remain unchanged
    expect(result.current.state.settings.telescope).toBe('dwarf_mini');
  });

  it('SET_LOADING updates loading state', () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: 'SET_LOADING',
        payload: { isLoading: true, message: 'Fetching weather...', percent: 50 },
      });
    });

    expect(result.current.state.isLoading).toBe(true);
    expect(result.current.state.loadingMessage).toBe('Fetching weather...');
    expect(result.current.state.loadingPercent).toBe(50);
  });

  it('SET_LOADING preserves previous message/percent when not provided', () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: 'SET_LOADING',
        payload: { isLoading: true, message: 'Step 1', percent: 25 },
      });
    });

    act(() => {
      result.current.dispatch({
        type: 'SET_LOADING',
        payload: { isLoading: true },
      });
    });

    expect(result.current.state.loadingMessage).toBe('Step 1');
    expect(result.current.state.loadingPercent).toBe(25);
  });

  it('SET_ERROR clears loading and sets error', () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: 'SET_LOADING',
        payload: { isLoading: true },
      });
    });

    act(() => {
      result.current.dispatch({
        type: 'SET_ERROR',
        payload: 'Network error',
      });
    });

    expect(result.current.state.error).toBe('Network error');
    expect(result.current.state.isLoading).toBe(false);
  });

  it('CLEAR_FORECAST resets forecast data', () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: 'SET_FORECAST',
        payload: {
          forecasts: [],
          scoredObjects: new Map(),
          bestNights: ['2025-01-15'],
        },
      });
    });

    expect(result.current.state.forecasts).toEqual([]);
    expect(result.current.state.bestNights).toEqual(['2025-01-15']);

    act(() => {
      result.current.dispatch({ type: 'CLEAR_FORECAST' });
    });

    expect(result.current.state.forecasts).toBeNull();
    expect(result.current.state.scoredObjects).toBeNull();
    expect(result.current.state.bestNights).toEqual([]);
  });

  it('SET_FORECAST clears error', () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    act(() => {
      result.current.dispatch({ type: 'SET_ERROR', payload: 'Some error' });
    });
    expect(result.current.state.error).toBe('Some error');

    act(() => {
      result.current.dispatch({
        type: 'SET_FORECAST',
        payload: {
          forecasts: [],
          scoredObjects: new Map(),
          bestNights: [],
        },
      });
    });

    expect(result.current.state.error).toBeNull();
  });

  it('SET_SETUP_COMPLETE updates setup state', () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    act(() => {
      result.current.dispatch({ type: 'SET_SETUP_COMPLETE', payload: true });
    });

    expect(result.current.state.isSetupComplete).toBe(true);
  });

  it('SET_OFFLINE updates offline state', () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    act(() => {
      result.current.dispatch({ type: 'SET_OFFLINE', payload: true });
    });

    expect(result.current.state.isOffline).toBe(true);
  });

  it('updateSettings dispatches SET_SETTINGS', () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    act(() => {
      result.current.updateSettings({ forecastDays: 10 });
    });

    expect(result.current.state.settings.forecastDays).toBe(10);
  });

  it('completeSetup dispatches SET_SETUP_COMPLETE', () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    act(() => {
      result.current.completeSetup();
    });

    expect(result.current.state.isSetupComplete).toBe(true);
  });

  it('setProgress dispatches SET_LOADING with message and percent', () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    act(() => {
      result.current.setProgress('Loading DSO catalog...', 75);
    });

    expect(result.current.state.isLoading).toBe(true);
    expect(result.current.state.loadingMessage).toBe('Loading DSO catalog...');
    expect(result.current.state.loadingPercent).toBe(75);
  });

  it('RESET_SETTINGS resets to defaults', () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    act(() => {
      result.current.updateSettings({ forecastDays: 30, maxObjects: 50 });
    });
    expect(result.current.state.settings.forecastDays).toBe(30);

    act(() => {
      result.current.dispatch({ type: 'RESET_SETTINGS' });
    });

    // Should be reset (locale-based defaults)
    expect(result.current.state.settings.forecastDays).toBe(7);
    expect(result.current.state.settings.maxObjects).toBe(8);
  });
});
