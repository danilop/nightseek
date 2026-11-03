/** Shared minimum for a useful imaging opportunity, in elapsed time. */
export const MIN_OBSERVING_WINDOW_MS = 30 * 60_000;

export interface TimeWindow {
  start: Date;
  end: Date;
}

/** Planning utility: quality above a 20-point floor, squared × integration hours. Not an SNR prediction. */
function sessionUtility(window: TimeWindow & { score: number }): number {
  return (
    Math.max(0, Number(window.end) - Number(window.start)) *
    (Math.max(0, window.score - 20) / 80) ** 2
  );
}

/** Balance conditions and integration time; do not discard long, slightly less perfect sessions. */
export function compareObservingWindows(
  a: TimeWindow & { score: number },
  b: TimeWindow & { score: number }
): number {
  return (
    sessionUtility(b) - sessionUtility(a) ||
    b.score - a.score ||
    Number(b.end) - Number(b.start) - (Number(a.end) - Number(a.start)) ||
    Number(a.start) - Number(b.start)
  );
}
