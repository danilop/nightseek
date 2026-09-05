import { useCallback, useEffect, useState } from 'react';

const KEY = 'nightseek:watchlist';
const EVENT = 'nightseek:watchlist-changed';

function readWatchlist(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(value)
      ? [
          ...new Set(value.filter((id): id is string => typeof id === 'string' && id.length < 150)),
        ].slice(0, 100)
      : [];
  } catch {
    return [];
  }
}

/** Small, local-only target list shared by the overview and target details. */
export function useWatchlist() {
  const [saved, setSaved] = useState(readWatchlist);
  useEffect(() => {
    const update = () => setSaved(readWatchlist());
    window.addEventListener(EVENT, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(EVENT, update);
      window.removeEventListener('storage', update);
    };
  }, []);
  const toggle = useCallback((id: string) => {
    const current = readWatchlist();
    const next = current.includes(id)
      ? current.filter(value => value !== id)
      : [...current, id].slice(-100);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(EVENT));
    } catch {
      // Keep this session usable when storage is disabled.
      setSaved(next);
    }
  }, []);
  return { saved, toggle };
}
