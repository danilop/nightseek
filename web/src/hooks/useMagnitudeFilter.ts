import { useCallback, useEffect, useState } from 'react';

const KEY = 'nightseek:magLimit';
const EVENT = 'nightseek:magnitude-filter-changed';
function readLimit(): number | null {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === null || saved.trim() === '') return null;
    const value = Number(saved);
    return Number.isFinite(value) && value >= -30 && value <= 40 ? value : null;
  } catch {
    return null;
  }
}

/** One persisted filter for target lists, overview recommendations and search. */
export function useMagnitudeFilter() {
  const [limit, setLimit] = useState(readLimit);
  useEffect(() => {
    const sync = (event: Event) => setLimit((event as CustomEvent<number | null>).detail);
    const storage = () => setLimit(readLimit());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', storage);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', storage);
    };
  }, []);
  const updateLimit = useCallback((value: number | null) => {
    const next =
      value !== null && Number.isFinite(value) && value >= -30 && value <= 40 ? value : null;
    try {
      if (next === null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, String(next));
    } catch {
      /* Keep this session usable without storage. */
    }
    setLimit(next);
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }, []);
  return { limit, setLimit: updateLimit };
}
