import * as Astronomy from 'astronomy-engine';
import type { EclipseSeason } from '@/types';

/**
 * Eclipse season window in days before/after a node crossing
 * Eclipses can only occur when the Moon is within ~17 days of crossing a node
 */
const ECLIPSE_SEASON_WINDOW_DAYS = 17;

/**
 * Search for the next lunar node crossing
 */
function searchNextMoonNode(startDate: Date): Astronomy.NodeEventInfo | null {
  try {
    return Astronomy.SearchMoonNode(startDate);
  } catch (_error) {
    return null;
  }
}

/**
 * Search for the previous lunar node crossing before a date
 */
function searchPreviousMoonNode(date: Date): Astronomy.NodeEventInfo | null {
  // Search from 30 days before
  const searchStart = new Date(date);
  searchStart.setDate(searchStart.getDate() - 30);

  let lastNode: Astronomy.NodeEventInfo | null = null;
  let currentNode = searchNextMoonNode(searchStart);

  while (currentNode && currentNode.time.date.getTime() < date.getTime()) {
    lastNode = currentNode;
    currentNode = Astronomy.NextMoonNode(currentNode);
  }

  return lastNode;
}

/**
 * Build eclipse season info from a node event
 */
function buildEclipseSeason(node: Astronomy.NodeEventInfo, isActive: boolean): EclipseSeason {
  const windowStart = new Date(node.time.date);
  windowStart.setDate(windowStart.getDate() - ECLIPSE_SEASON_WINDOW_DAYS);

  const windowEnd = new Date(node.time.date);
  windowEnd.setDate(windowEnd.getDate() + ECLIPSE_SEASON_WINDOW_DAYS);

  return {
    nodeType: node.kind === 0 ? 'ascending' : 'descending',
    nodeCrossingTime: node.time.date,
    windowStart,
    windowEnd,
    isActive,
  };
}

/**
 * Determine if a date is within an eclipse season
 *
 * Eclipse seasons occur when the Moon is within ~17 days of crossing
 * either the ascending or descending node of its orbit.
 */
export function getEclipseSeasonInfo(date: Date): EclipseSeason | null {
  const previousNode = searchPreviousMoonNode(date);
  const nextNode = searchNextMoonNode(date);

  if (!previousNode && !nextNode) {
    return null;
  }

  // Check if we're within the window of the previous node
  if (previousNode) {
    const daysSincePrevious =
      (date.getTime() - previousNode.time.date.getTime()) / (24 * 60 * 60 * 1000);

    if (daysSincePrevious <= ECLIPSE_SEASON_WINDOW_DAYS) {
      return buildEclipseSeason(previousNode, true);
    }
  }

  // Check if we're within the window of the next node
  if (nextNode) {
    const daysToNext = (nextNode.time.date.getTime() - date.getTime()) / (24 * 60 * 60 * 1000);

    if (daysToNext <= ECLIPSE_SEASON_WINDOW_DAYS) {
      return buildEclipseSeason(nextNode, true);
    }

    // Not in an eclipse season, but return info about the next one
    return buildEclipseSeason(nextNode, false);
  }

  return null;
}

/**
 * Get upcoming eclipse seasons within a time window
 */
export function getUpcomingEclipseSeasons(
  startDate: Date,
  windowDays: number = 90
): EclipseSeason[] {
  const seasons: EclipseSeason[] = [];
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + windowDays);

  let node = searchNextMoonNode(startDate);

  while (node && node.time.date.getTime() <= endDate.getTime()) {
    const windowStart = new Date(node.time.date);
    windowStart.setDate(windowStart.getDate() - ECLIPSE_SEASON_WINDOW_DAYS);

    const windowEnd = new Date(node.time.date);
    windowEnd.setDate(windowEnd.getDate() + ECLIPSE_SEASON_WINDOW_DAYS);

    const isActive = startDate >= windowStart && startDate <= windowEnd;

    seasons.push({
      nodeType: node.kind === 0 ? 'ascending' : 'descending',
      nodeCrossingTime: node.time.date,
      windowStart,
      windowEnd,
      isActive,
    });

    node = Astronomy.NextMoonNode(node);
  }

  return seasons;
}

/**
 * Check if a date is within an active eclipse season
 */
export function isInEclipseSeason(date: Date): boolean {
  const season = getEclipseSeasonInfo(date);
  return season?.isActive ?? false;
}

/**
 * Get a description of the eclipse season
 */
export function getEclipseSeasonDescription(season: EclipseSeason): string {
  if (season.isActive) {
    const startMonth = season.windowStart.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    const endMonth = season.windowEnd.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    return `Eclipse Season Active: ${startMonth} - ${endMonth}`;
  }

  const daysToSeason = Math.round(
    (season.windowStart.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  );

  if (daysToSeason <= 30) {
    const startMonth = season.windowStart.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    return `Eclipse Season begins ${startMonth} (${daysToSeason} days)`;
  }

  return '';
}

/**
 * Get the next node crossing time and type
 */
export function getNextNodeCrossing(date: Date): {
  time: Date;
  nodeType: 'ascending' | 'descending';
  daysUntil: number;
} | null {
  const node = searchNextMoonNode(date);
  if (!node) return null;

  const daysUntil = Math.round((node.time.date.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));

  return {
    time: node.time.date,
    nodeType: node.kind === 0 ? 'ascending' : 'descending',
    daysUntil,
  };
}
