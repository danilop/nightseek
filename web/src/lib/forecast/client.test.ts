import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockNightForecast } from '@/test/factories';
import type { Location, Settings } from '@/types';
import { generateForecastInBackground } from './client';

class TestWorker {
  static instance: TestWorker;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: { message: string }) => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor() {
    TestWorker.instance = this;
  }
}
const location = { latitude: 0, longitude: 0 } as Location;
const settings = { forecastDays: 7 } as Settings;
afterEach(() => vi.unstubAllGlobals());
describe('background forecast lifecycle', () => {
  it('publishes the first night before completion and cleans up', async () => {
    vi.stubGlobal('Worker', TestWorker);
    const partial = vi.fn();
    const progress = vi.fn();
    const task = generateForecastInBackground(
      location,
      settings,
      progress,
      partial,
      new AbortController().signal
    );
    const worker = TestWorker.instance;
    const result = { forecasts: [], scoredObjects: new Map(), bestNights: [], timezone: 'UTC' };
    worker.onmessage?.({ data: { type: 'progress', message: 'First night', percent: 20 } });
    worker.onmessage?.({ data: { type: 'partial', result } });
    expect(partial).toHaveBeenCalledWith(result);
    expect(progress).toHaveBeenCalledWith('First night', 20);
    expect(worker.terminate).not.toHaveBeenCalled();
    worker.onmessage?.({ data: { type: 'complete', result } });
    await expect(task).resolves.toEqual(result);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it('accumulates new nights without mutating previously displayed snapshots', async () => {
    vi.stubGlobal('Worker', TestWorker);
    const partial = vi.fn();
    const task = generateForecastInBackground(
      location,
      settings,
      vi.fn(),
      partial,
      new AbortController().signal
    );
    const night = createMockNightForecast();
    const worker = TestWorker.instance;
    const first = {
      forecasts: [night],
      scoredObjects: new Map([['first', []]]),
      bestNights: ['first'],
      timezone: 'UTC',
    };
    worker.onmessage?.({ data: { type: 'partial', result: first } });
    const snapshot = partial.mock.calls[0][0];
    worker.onmessage?.({
      data: { type: 'partial', result: { ...first, scoredObjects: new Map([['second', []]]) } },
    });
    expect(snapshot.forecasts).toHaveLength(1);
    expect(snapshot.scoredObjects.size).toBe(1);
    expect(partial.mock.calls[1][0].forecasts).toHaveLength(2);
    expect(partial.mock.calls[1][0].scoredObjects.size).toBe(2);
    worker.onmessage?.({ data: { type: 'complete', result: partial.mock.calls[1][0] } });
    await task;
  });

  it('immediately terminates a superseded request', async () => {
    vi.stubGlobal('Worker', TestWorker);
    const controller = new AbortController();
    const task = generateForecastInBackground(
      location,
      settings,
      vi.fn(),
      vi.fn(),
      controller.signal
    );
    controller.abort();
    await expect(task).rejects.toMatchObject({ name: 'AbortError' });
    expect(TestWorker.instance.terminate).toHaveBeenCalledOnce();
  });
  it('surfaces worker errors and releases the worker', async () => {
    vi.stubGlobal('Worker', TestWorker);
    const task = generateForecastInBackground(
      location,
      settings,
      vi.fn(),
      vi.fn(),
      new AbortController().signal
    );
    TestWorker.instance.onerror?.({ message: 'Worker failed' });
    await expect(task).rejects.toThrow('Worker failed');
    expect(TestWorker.instance.terminate).toHaveBeenCalledOnce();
  });
});
