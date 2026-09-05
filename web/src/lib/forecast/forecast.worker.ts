import { generateForecast } from '../analyzer';
import type { ForecastMessage, ForecastRequest } from './protocol';

const send = (message: ForecastMessage) => self.postMessage(message);

self.onmessage = async ({ data }: MessageEvent<ForecastRequest>) => {
  try {
    const result = await generateForecast(
      data.location,
      data.settings,
      (message, percent) => send({ type: 'progress', message, percent }),
      result => {
        // Transfer only the new night: repeatedly cloning the growing catalogue
        // would make a long forecast's transfer cost quadratic.
        const latestObjects = [...result.scoredObjects.entries()].slice(-1);
        send({
          type: 'partial',
          result: {
            ...result,
            forecasts: result.forecasts.slice(-1),
            scoredObjects: new Map(latestObjects),
          },
        });
      }
    );
    send({ type: 'complete', result });
  } catch (error) {
    send({ type: 'error', message: error instanceof Error ? error.message : 'Forecast failed' });
  }
};
