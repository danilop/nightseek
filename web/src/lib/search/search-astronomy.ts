import { nightDateAtOffset } from '../forecast/night-dates';

/**
 * Evaluate every day until a match is found.
 *
 * Astronomy visibility is not monotonic for moving bodies, polar darkness,
 * or short seasonal windows, so exponential/binary probing is unsafe.
 */
export async function findFirstMatchingDay<T>(
  startDate: Date,
  maxDays: number,
  evaluate: (date: Date) => T | null | Promise<T | null>,
  timezone = 'UTC'
): Promise<T | null> {
  for (let dayOffset = 0; dayOffset <= maxDays; dayOffset++) {
    if (dayOffset > 0 && dayOffset % 30 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    const match = await evaluate(nightDateAtOffset(startDate, timezone, dayOffset));
    if (match !== null) return match;
  }

  return null;
}
