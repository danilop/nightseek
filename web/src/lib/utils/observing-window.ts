/** Shared minimum for a useful imaging opportunity, in elapsed time. */
export const MIN_OBSERVING_WINDOW_MS = 30 * 60_000;

export interface TimeWindow {
  start: Date;
  end: Date;
}

/** Compare quality first, then available integration time, then earlier start. */
export function compareObservingWindows(
  a: TimeWindow & { score: number },
  b: TimeWindow & { score: number }
): number {
  return (
    b.score - a.score ||
    Number(b.end) - Number(b.start) - (Number(a.end) - Number(a.start)) ||
    Number(a.start) - Number(b.start)
  );
}
