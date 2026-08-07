import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCached, setCache } from '@/lib/utils/cache';
import {
  createDefaultHorizonProfile,
  getHorizonProfileCacheKey,
  type HorizonAltitudeLevel,
  normalizeHorizonProfile,
} from '@/lib/utils/horizon-profile';
import { useApp } from '@/stores/AppContext';
import type { HorizonProfile, HorizonSectorLabel } from '@/types';

export interface HorizonProfileController {
  horizonProfile: HorizonProfile;
  /** False until the site's stored profile has been read back. */
  isReady: boolean;
  setMinimumAltitude: (minimumAltitude: number) => void;
  setSectorAltitude: (sectorLabel: HorizonSectorLabel, minAltitude: HorizonAltitudeLevel) => void;
  reset: () => void;
}

/**
 * The site's horizon obstructions, persisted per location. Lives at the
 * ForecastView level so both the Targets tab editor and the target detail
 * panel read the same profile.
 */
export function useHorizonProfile(): HorizonProfileController {
  const { state } = useApp();
  const { location } = state;
  const [horizonProfile, setHorizonProfile] = useState<HorizonProfile>(createDefaultHorizonProfile);
  const [isReady, setIsReady] = useState(false);

  const cacheKey = useMemo(
    () => (location ? getHorizonProfileCacheKey(location) : null),
    [location]
  );

  useEffect(() => {
    let cancelled = false;
    const defaultProfile = createDefaultHorizonProfile();

    setIsReady(false);
    setHorizonProfile(defaultProfile);

    if (!cacheKey) {
      setIsReady(true);
      return () => {
        cancelled = true;
      };
    }

    void getCached<HorizonProfile>(cacheKey, Number.POSITIVE_INFINITY).then(cached => {
      if (cancelled) return;
      setHorizonProfile(normalizeHorizonProfile(cached ?? defaultProfile));
      setIsReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [cacheKey]);

  useEffect(() => {
    if (!isReady || !cacheKey) return;
    void setCache(cacheKey, horizonProfile);
  }, [isReady, cacheKey, horizonProfile]);

  const setMinimumAltitude = useCallback((minimumAltitude: number) => {
    setHorizonProfile(current => ({ ...current, minimumAltitude }));
  }, []);

  const setSectorAltitude = useCallback(
    (sectorLabel: HorizonSectorLabel, minAltitude: HorizonAltitudeLevel) => {
      setHorizonProfile(current => ({
        ...current,
        sectors: current.sectors.map(sector =>
          sector.label === sectorLabel ? { ...sector, minAltitude } : sector
        ),
      }));
    },
    []
  );

  const reset = useCallback(() => {
    setHorizonProfile(createDefaultHorizonProfile());
  }, []);

  return { horizonProfile, isReady, setMinimumAltitude, setSectorAltitude, reset };
}
