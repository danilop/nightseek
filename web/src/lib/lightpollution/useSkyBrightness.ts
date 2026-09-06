import { useEffect, useState } from 'react';
import { loadSkyBrightness, type SkyBrightness } from './sky-brightness';

export function useSkyBrightness(latitude: number, longitude: number) {
  const [result, setResult] = useState<{
    latitude: number;
    longitude: number;
    data: SkyBrightness | null;
    attempt: number;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const retry = () => setAttempt(value => value + 1);
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, []);
  useEffect(() => {
    let active = true;
    void loadSkyBrightness(latitude, longitude).then(data => {
      if (active) setResult({ latitude, longitude, data, attempt });
    });
    return () => {
      active = false;
    };
  }, [latitude, longitude, attempt]);
  const current =
    result?.latitude === latitude && result?.longitude === longitude && result?.attempt === attempt;
  return { data: current ? result.data : null, loading: !current };
}
