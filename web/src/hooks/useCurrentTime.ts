import { useEffect, useState } from 'react';

/**
 * Returns the current time, updating at the specified interval.
 * Useful for time-aware UI that needs to react to the passage of real time.
 */
export function useCurrentTime(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
