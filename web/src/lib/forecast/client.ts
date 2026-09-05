import type { Location, Settings } from '@/types';
import type { ForecastResult } from '../analyzer';
import type { ForecastMessage } from './protocol';

/** One worker per active request keeps astronomy off the UI thread. Superseded
 * requests terminate immediately instead of calculating an unused week. */
export async function generateForecastInBackground(
  location: Location,
  settings: Settings,
  onProgress: (message: string, percent: number) => void,
  onPartial: (result: ForecastResult) => void,
  signal: AbortSignal
): Promise<ForecastResult> {
  signal.throwIfAborted();
  if (typeof Worker === 'undefined') {
    const { generateForecast } = await import('../analyzer');
    return generateForecast(location, settings, onProgress, onPartial, signal);
  }

  return new Promise((resolve, reject) => {
    let accumulated: ForecastResult = {
      forecasts: [],
      scoredObjects: new Map(),
      bestNights: [],
      timezone: '',
    };
    const worker = new Worker(new URL('./forecast.worker.ts', import.meta.url), { type: 'module' });
    const cleanup = () => {
      signal.removeEventListener('abort', abort);
      worker.terminate();
    };
    const abort = () => {
      cleanup();
      reject(signal.reason);
    };
    signal.addEventListener('abort', abort, { once: true });
    worker.onerror = event => {
      cleanup();
      reject(
        new Error(event.message || 'Could not start the forecast calculator. Try refreshing.')
      );
    };
    worker.onmessage = ({ data }: MessageEvent<ForecastMessage>) => {
      switch (data.type) {
        case 'progress':
          onProgress(data.message, data.percent);
          break;
        case 'partial':
          accumulated = {
            ...data.result,
            forecasts: [...accumulated.forecasts, ...data.result.forecasts],
            scoredObjects: new Map([...accumulated.scoredObjects, ...data.result.scoredObjects]),
          };
          onPartial(accumulated);
          break;
        case 'complete':
          cleanup();
          resolve(data.result);
          break;
        case 'error':
          cleanup();
          reject(new Error(data.message));
          break;
      }
    };
    worker.postMessage({ location, settings });
  });
}
