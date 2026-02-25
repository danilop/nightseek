import { useCallback, useEffect, useState } from 'react';
import type { QuickFilterId, SecondarySortField } from '@/types';

const STORAGE_KEY = 'nightseek:uiState';

export type ActiveTab = 'overview' | 'targets' | 'sky' | 'events';

const VALID_SECONDARY_SORTS: readonly SecondarySortField[] = [
  'score',
  'magnitude',
  'altitude',
  'moonSep',
  'imaging',
  'frameFill',
];

const VALID_QUICK_FILTERS: readonly QuickFilterId[] = [
  'hasImaging',
  'moonSafe',
  'above45',
  'highRated',
];

interface UIState {
  // Expanded sections
  expandedCategories: Record<string, boolean>;
  jupiterMoonsExpanded: boolean;
  weatherDetailsExpanded: boolean;

  // Category ordering (array of category keys)
  categoryOrder: string[];

  // Active tab in forecast view
  activeTab: ActiveTab;

  // Targets tab: secondary sort within categories
  secondarySort: SecondarySortField;

  // Targets tab: quick filter toggles
  activeQuickFilters: QuickFilterId[];

  // Targets tab: tonight picks dismissal
  tonightPicksDismissed: boolean;
}

const DEFAULT_CATEGORY_ORDER = [
  'nebulae',
  'galaxies',
  'clusters',
  'comets',
  'planets',
  'jupiter_moons',
  'minor_planets',
  'milky_way',
  'other',
];

const DEFAULT_UI_STATE: UIState = {
  expandedCategories: {
    nebulae: true,
    galaxies: true,
    clusters: true,
    comets: true,
    planets: true,
    jupiter_moons: true,
    minor_planets: false,
    milky_way: true,
    other: false,
  },
  jupiterMoonsExpanded: false,
  weatherDetailsExpanded: false,
  categoryOrder: DEFAULT_CATEGORY_ORDER,
  activeTab: 'overview',
  secondarySort: 'score',
  activeQuickFilters: [],
  tonightPicksDismissed: false,
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: localStorage validation with type guards
function loadUIState(): UIState {
  if (typeof window === 'undefined') return DEFAULT_UI_STATE;

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Validate that parsed is a plain object with expected shapes
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return DEFAULT_UI_STATE;
      }
      const VALID_TABS: readonly string[] = ['overview', 'targets', 'sky', 'events'];
      const activeTab =
        typeof parsed.activeTab === 'string' && VALID_TABS.includes(parsed.activeTab)
          ? (parsed.activeTab as ActiveTab)
          : DEFAULT_UI_STATE.activeTab;
      const expandedCategories =
        typeof parsed.expandedCategories === 'object' &&
        parsed.expandedCategories !== null &&
        !Array.isArray(parsed.expandedCategories)
          ? parsed.expandedCategories
          : {};
      const categoryOrder = Array.isArray(parsed.categoryOrder) ? parsed.categoryOrder : [];
      const secondarySort =
        typeof parsed.secondarySort === 'string' &&
        VALID_SECONDARY_SORTS.includes(parsed.secondarySort as SecondarySortField)
          ? (parsed.secondarySort as SecondarySortField)
          : DEFAULT_UI_STATE.secondarySort;
      const activeQuickFilters = Array.isArray(parsed.activeQuickFilters)
        ? (parsed.activeQuickFilters as unknown[]).filter(
            (id): id is QuickFilterId =>
              typeof id === 'string' && VALID_QUICK_FILTERS.includes(id as QuickFilterId)
          )
        : DEFAULT_UI_STATE.activeQuickFilters;
      const tonightPicksDismissed =
        typeof parsed.tonightPicksDismissed === 'boolean'
          ? parsed.tonightPicksDismissed
          : DEFAULT_UI_STATE.tonightPicksDismissed;
      return {
        ...DEFAULT_UI_STATE,
        jupiterMoonsExpanded:
          typeof parsed.jupiterMoonsExpanded === 'boolean'
            ? parsed.jupiterMoonsExpanded
            : DEFAULT_UI_STATE.jupiterMoonsExpanded,
        weatherDetailsExpanded:
          typeof parsed.weatherDetailsExpanded === 'boolean'
            ? parsed.weatherDetailsExpanded
            : DEFAULT_UI_STATE.weatherDetailsExpanded,
        activeTab,
        expandedCategories: {
          ...DEFAULT_UI_STATE.expandedCategories,
          ...expandedCategories,
        },
        categoryOrder: mergeOrder(categoryOrder, DEFAULT_CATEGORY_ORDER),
        secondarySort,
        activeQuickFilters,
        tonightPicksDismissed,
      };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_UI_STATE;
}

// Merge saved order with defaults, preserving user order but adding any new categories
function mergeOrder(saved: string[], defaults: string[]): string[] {
  const result = [...saved];
  for (const key of defaults) {
    if (!result.includes(key)) {
      result.push(key);
    }
  }
  // Remove any categories that no longer exist
  return result.filter(key => defaults.includes(key));
}

function saveUIState(state: UIState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// Singleton state to share across hook instances
let globalState: UIState = loadUIState();
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

export function resetUIState(): void {
  globalState = { ...DEFAULT_UI_STATE };
  localStorage.removeItem(STORAGE_KEY);
  notifyListeners();
}

export function useUIState() {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const listener = () => forceUpdate({});
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const setCategoryExpanded = useCallback((categoryKey: string, expanded: boolean) => {
    globalState = {
      ...globalState,
      expandedCategories: {
        ...globalState.expandedCategories,
        [categoryKey]: expanded,
      },
    };
    saveUIState(globalState);
    notifyListeners();
  }, []);

  const toggleCategoryExpanded = useCallback(
    (categoryKey: string) => {
      const current = globalState.expandedCategories[categoryKey] ?? false;
      setCategoryExpanded(categoryKey, !current);
    },
    [setCategoryExpanded]
  );

  const setJupiterMoonsExpanded = useCallback((expanded: boolean) => {
    globalState = {
      ...globalState,
      jupiterMoonsExpanded: expanded,
    };
    saveUIState(globalState);
    notifyListeners();
  }, []);

  const setWeatherDetailsExpanded = useCallback((expanded: boolean) => {
    globalState = {
      ...globalState,
      weatherDetailsExpanded: expanded,
    };
    saveUIState(globalState);
    notifyListeners();
  }, []);

  const setActiveTab = useCallback((tab: ActiveTab) => {
    globalState = {
      ...globalState,
      activeTab: tab,
    };
    saveUIState(globalState);
    notifyListeners();
  }, []);

  const setCategoryOrder = useCallback((order: string[]) => {
    globalState = {
      ...globalState,
      categoryOrder: order,
    };
    saveUIState(globalState);
    notifyListeners();
  }, []);

  const reorderCategory = useCallback(
    (fromIndex: number, toIndex: number) => {
      const newOrder = [...globalState.categoryOrder];
      const [removed] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, removed);
      setCategoryOrder(newOrder);
    },
    [setCategoryOrder]
  );

  const isCategoryExpanded = useCallback((categoryKey: string, defaultExpanded: boolean) => {
    return globalState.expandedCategories[categoryKey] ?? defaultExpanded;
  }, []);

  const setSecondarySort = useCallback((field: SecondarySortField) => {
    globalState = { ...globalState, secondarySort: field };
    saveUIState(globalState);
    notifyListeners();
  }, []);

  const toggleQuickFilter = useCallback((id: QuickFilterId) => {
    const current = globalState.activeQuickFilters;
    const next = current.includes(id) ? current.filter(f => f !== id) : [...current, id];
    globalState = { ...globalState, activeQuickFilters: next };
    saveUIState(globalState);
    notifyListeners();
  }, []);

  const clearQuickFilters = useCallback(() => {
    globalState = { ...globalState, activeQuickFilters: [] };
    saveUIState(globalState);
    notifyListeners();
  }, []);

  const setTonightPicksDismissed = useCallback((dismissed: boolean) => {
    globalState = { ...globalState, tonightPicksDismissed: dismissed };
    saveUIState(globalState);
    notifyListeners();
  }, []);

  return {
    // State
    expandedCategories: globalState.expandedCategories,
    jupiterMoonsExpanded: globalState.jupiterMoonsExpanded,
    weatherDetailsExpanded: globalState.weatherDetailsExpanded,
    categoryOrder: globalState.categoryOrder,
    activeTab: globalState.activeTab,
    secondarySort: globalState.secondarySort,
    activeQuickFilters: globalState.activeQuickFilters,
    tonightPicksDismissed: globalState.tonightPicksDismissed,

    // Actions
    setCategoryExpanded,
    toggleCategoryExpanded,
    isCategoryExpanded,
    setJupiterMoonsExpanded,
    setWeatherDetailsExpanded,
    setActiveTab,
    setCategoryOrder,
    reorderCategory,
    setSecondarySort,
    toggleQuickFilter,
    clearQuickFilters,
    setTonightPicksDismissed,
  };
}

// Export for getting ordered categories with their data
export function getOrderedCategories<T extends { key: string }>(
  configs: T[],
  order: string[]
): T[] {
  const configMap = new Map(configs.map(c => [c.key, c]));
  const result: T[] = [];

  // Add categories in saved order
  for (const key of order) {
    const config = configMap.get(key);
    if (config) {
      result.push(config);
      configMap.delete(key);
    }
  }

  // Add any remaining categories (new ones not in saved order)
  for (const config of configMap.values()) {
    result.push(config);
  }

  return result;
}
