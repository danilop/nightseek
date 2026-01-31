import * as Astronomy from 'astronomy-engine';
import type { MoonPhaseEvent, NightInfo } from '@/types';

/**
 * Moon phase quarter names
 */
const PHASE_NAMES: Record<number, MoonPhaseEvent['phase']> = {
  0: 'new',
  1: 'first_quarter',
  2: 'full',
  3: 'third_quarter',
};

/**
 * Get the display name for a moon phase
 */
export function getMoonPhaseName(phase: MoonPhaseEvent['phase']): string {
  switch (phase) {
    case 'new':
      return 'New Moon';
    case 'first_quarter':
      return 'First Quarter';
    case 'full':
      return 'Full Moon';
    case 'third_quarter':
      return 'Third Quarter';
  }
}

/**
 * Get emoji for a moon phase
 */
export function getMoonPhaseEmoji(phase: MoonPhaseEvent['phase']): string {
  switch (phase) {
    case 'new':
      return '\u{1F311}'; // New moon
    case 'first_quarter':
      return '\u{1F313}'; // First quarter
    case 'full':
      return '\u{1F315}'; // Full moon
    case 'third_quarter':
      return '\u{1F317}'; // Third quarter
  }
}

/**
 * Search for the previous moon quarter before a given date
 */
function searchPreviousMoonQuarter(date: Date): Astronomy.MoonQuarter {
  // Search backwards by checking each quarter up to 30 days back
  const searchDate = new Date(date);
  searchDate.setDate(searchDate.getDate() - 30);

  let lastQuarter = Astronomy.SearchMoonQuarter(searchDate);

  // Find the last quarter before our target date
  while (lastQuarter.time.date.getTime() < date.getTime()) {
    const next = Astronomy.NextMoonQuarter(lastQuarter);
    if (next.time.date.getTime() > date.getTime()) {
      break;
    }
    lastQuarter = next;
  }

  return lastQuarter;
}

/**
 * Check if a moon phase event occurs during a given night
 */
function isPhaseTonight(phaseTime: Date, nightInfo: NightInfo): boolean {
  const phaseTimestamp = phaseTime.getTime();
  return (
    phaseTimestamp >= nightInfo.sunset.getTime() && phaseTimestamp <= nightInfo.sunrise.getTime()
  );
}

/**
 * Calculate days until a moon phase event
 */
function daysUntilPhase(fromDate: Date, phaseTime: Date): number {
  const diff = phaseTime.getTime() - fromDate.getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

/**
 * Create a MoonPhaseEvent from an Astronomy.MoonQuarter
 */
function createMoonPhaseEvent(
  quarter: Astronomy.MoonQuarter,
  referenceDate: Date,
  nightInfo: NightInfo | null
): MoonPhaseEvent {
  const phaseTime = quarter.time.date;
  return {
    phase: PHASE_NAMES[quarter.quarter],
    time: phaseTime,
    isTonight: nightInfo ? isPhaseTonight(phaseTime, nightInfo) : false,
    daysUntil: daysUntilPhase(referenceDate, phaseTime),
  };
}

/**
 * Get moon phase events: current phase, next phase, and tonight's event if any
 *
 * Uses astronomy-engine's SearchMoonQuarter to find exact phase times.
 */
export function getMoonPhaseEvents(
  date: Date,
  nightInfo: NightInfo
): {
  current: MoonPhaseEvent;
  next: MoonPhaseEvent;
  tonightEvent: MoonPhaseEvent | null;
} {
  // Find the most recent moon quarter
  const previousQuarter = searchPreviousMoonQuarter(date);
  const current = createMoonPhaseEvent(previousQuarter, date, nightInfo);

  // Find the next moon quarter
  const nextQuarter = Astronomy.NextMoonQuarter(previousQuarter);
  const next = createMoonPhaseEvent(nextQuarter, date, nightInfo);

  // Check if either current or next phase occurs tonight
  let tonightEvent: MoonPhaseEvent | null = null;

  if (current.isTonight) {
    tonightEvent = current;
  } else if (next.isTonight) {
    tonightEvent = next;
  }

  return { current, next, tonightEvent };
}

/**
 * Get the exact time of the next occurrence of a specific moon phase
 */
export function getNextPhaseOfType(date: Date, phase: MoonPhaseEvent['phase']): MoonPhaseEvent {
  const targetQuarter = Object.entries(PHASE_NAMES).find(([_, name]) => name === phase)?.[0];

  if (targetQuarter === undefined) {
    throw new Error(`Unknown moon phase: ${phase}`);
  }

  const targetQuarterNum = parseInt(targetQuarter, 10);

  // Search for the next occurrence of this phase
  let quarter = Astronomy.SearchMoonQuarter(date);

  // Keep advancing until we find the target phase
  while (quarter.quarter !== targetQuarterNum) {
    quarter = Astronomy.NextMoonQuarter(quarter);
  }

  // If this phase already passed today, get the next one
  if (quarter.time.date.getTime() < date.getTime()) {
    // Need to advance 4 quarters (one full cycle)
    for (let i = 0; i < 4; i++) {
      quarter = Astronomy.NextMoonQuarter(quarter);
    }
  }

  return {
    phase,
    time: quarter.time.date,
    isTonight: false,
    daysUntil: daysUntilPhase(date, quarter.time.date),
  };
}

/**
 * Get all moon phases within a date range
 */
export function getMoonPhasesInRange(startDate: Date, endDate: Date): MoonPhaseEvent[] {
  const phases: MoonPhaseEvent[] = [];

  // Start with the first quarter on or after startDate
  let quarter = Astronomy.SearchMoonQuarter(startDate);

  // If the first result is before our start, advance to the next
  if (quarter.time.date.getTime() < startDate.getTime()) {
    quarter = Astronomy.NextMoonQuarter(quarter);
  }

  // Collect all phases until we pass endDate
  while (quarter.time.date.getTime() <= endDate.getTime()) {
    phases.push({
      phase: PHASE_NAMES[quarter.quarter],
      time: quarter.time.date,
      isTonight: false,
      daysUntil: daysUntilPhase(startDate, quarter.time.date),
    });
    quarter = Astronomy.NextMoonQuarter(quarter);
  }

  return phases;
}

/**
 * Get descriptive text for moon phase timing
 */
export function getMoonPhaseDescription(event: MoonPhaseEvent): string {
  const phaseName = getMoonPhaseName(event.phase);

  if (event.isTonight) {
    const hours = event.time.getHours();
    const minutes = event.time.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h = hours % 12 || 12;
    const m = minutes.toString().padStart(2, '0');
    return `${phaseName} at ${h}:${m} ${ampm}`;
  }

  if (event.daysUntil === 0) {
    return `${phaseName} today`;
  } else if (event.daysUntil === 1) {
    return `${phaseName} tomorrow`;
  } else if (event.daysUntil < 0) {
    const daysAgo = Math.abs(event.daysUntil);
    return `${phaseName} ${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`;
  }

  return `${phaseName} in ${event.daysUntil} days`;
}
