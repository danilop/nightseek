import { Eye, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function FieldTools() {
  const [red, setRed] = useState(false);
  const [keepAwake, setKeepAwake] = useState(false);
  const [awake, setAwake] = useState(false);
  const [wakeError, setWakeError] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.nightVision = String(red);
    return () => {
      delete document.documentElement.dataset.nightVision;
    };
  }, [red]);
  useEffect(() => {
    if (!keepAwake || !('wakeLock' in navigator)) return;
    let cancelled = false;
    let lock: WakeLockSentinel | null = null;
    const acquire = async () => {
      if (cancelled || (lock && !lock.released) || document.visibilityState !== 'visible') return;
      try {
        const next = await navigator.wakeLock.request('screen');
        if (cancelled) {
          await next.release();
          return;
        }
        lock = next;
        setAwake(true);
        setWakeError(false);
        next.addEventListener('release', () => setAwake(false), { once: true });
      } catch {
        if (!cancelled) {
          setAwake(false);
          setWakeError(true);
        }
      }
    };
    void acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', acquire);
      void lock?.release();
      setAwake(false);
    };
  }, [keepAwake]);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <button
        type="button"
        aria-pressed={red}
        onClick={() => setRed(value => !value)}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-gray-300 hover:bg-white/5"
      >
        <Eye className="h-4 w-4" /> {red ? 'Exit night vision' : 'Night vision'}
      </button>
      {'wakeLock' in navigator && (
        <button
          type="button"
          aria-pressed={keepAwake}
          onClick={() => setKeepAwake(value => !value)}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-gray-300 hover:bg-white/5"
        >
          <Sun className="h-4 w-4" />{' '}
          {awake ? 'Screen stays awake' : keepAwake ? 'Keep awake requested' : 'Keep screen awake'}
        </button>
      )}
      {wakeError && keepAwake && (
        <span role="status" className="text-amber-200">
          Your device could not keep the screen awake.
        </span>
      )}
    </div>
  );
}
