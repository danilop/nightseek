import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type { Location, Settings, NightForecast, ScoredObject } from '@/types';
import { getCached, setCache, CACHE_KEYS } from '@/lib/utils/cache';

interface AppState {
  location: Location | null;
  settings: Settings;
  forecasts: NightForecast[] | null;
  scoredObjects: Map<string, ScoredObject[]> | null;
  bestNights: string[];
  isLoading: boolean;
  loadingMessage: string;
  loadingPercent: number;
  error: string | null;
  isOffline: boolean;
  isSetupComplete: boolean;
}

type Action =
  | { type: 'SET_LOCATION'; payload: Location }
  | { type: 'SET_SETTINGS'; payload: Partial<Settings> }
  | { type: 'SET_FORECAST'; payload: { forecasts: NightForecast[]; scoredObjects: Map<string, ScoredObject[]>; bestNights: string[] } }
  | { type: 'SET_LOADING'; payload: { isLoading: boolean; message?: string; percent?: number } }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_OFFLINE'; payload: boolean }
  | { type: 'SET_SETUP_COMPLETE'; payload: boolean }
  | { type: 'CLEAR_FORECAST' };

const DEFAULT_SETTINGS: Settings = {
  forecastDays: 7,
  maxObjects: 8,
  cometMagnitude: 12.0,
  dsoMagnitude: 14.0,
  theme: 'dark',
};

const initialState: AppState = {
  location: null,
  settings: DEFAULT_SETTINGS,
  forecasts: null,
  scoredObjects: null,
  bestNights: [],
  isLoading: false,
  loadingMessage: '',
  loadingPercent: 0,
  error: null,
  isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
  isSetupComplete: false,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_LOCATION':
      return { ...state, location: action.payload, isSetupComplete: true };
    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    case 'SET_FORECAST':
      return {
        ...state,
        forecasts: action.payload.forecasts,
        scoredObjects: action.payload.scoredObjects,
        bestNights: action.payload.bestNights,
        error: null,
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload.isLoading,
        loadingMessage: action.payload.message ?? state.loadingMessage,
        loadingPercent: action.payload.percent ?? state.loadingPercent,
      };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'SET_OFFLINE':
      return { ...state, isOffline: action.payload };
    case 'SET_SETUP_COMPLETE':
      return { ...state, isSetupComplete: action.payload };
    case 'CLEAR_FORECAST':
      return { ...state, forecasts: null, scoredObjects: null, bestNights: [] };
    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  setLocation: (location: Location) => Promise<void>;
  updateSettings: (settings: Partial<Settings>) => void;
  setProgress: (message: string, percent: number) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load saved location and settings on mount
  useEffect(() => {
    async function loadSavedData() {
      // Load location
      const savedLocation = await getCached<Location>(CACHE_KEYS.LOCATION, Infinity);
      if (savedLocation) {
        dispatch({ type: 'SET_LOCATION', payload: savedLocation });
      }

      // Load settings from localStorage
      const savedSettings = localStorage.getItem('nightseek:settings');
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          dispatch({ type: 'SET_SETTINGS', payload: parsed });
        } catch {
          // Ignore parse errors
        }
      }
    }

    loadSavedData();
  }, []);

  // Persist settings to localStorage
  useEffect(() => {
    localStorage.setItem('nightseek:settings', JSON.stringify(state.settings));
  }, [state.settings]);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => dispatch({ type: 'SET_OFFLINE', payload: false });
    const handleOffline = () => dispatch({ type: 'SET_OFFLINE', payload: true });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const setLocation = useCallback(async (location: Location) => {
    dispatch({ type: 'SET_LOCATION', payload: location });
    await setCache(CACHE_KEYS.LOCATION, location);
  }, []);

  const updateSettings = useCallback((settings: Partial<Settings>) => {
    dispatch({ type: 'SET_SETTINGS', payload: settings });
  }, []);

  const setProgress = useCallback((message: string, percent: number) => {
    dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message, percent } });
  }, []);

  const value: AppContextValue = {
    state,
    dispatch,
    setLocation,
    updateSettings,
    setProgress,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
