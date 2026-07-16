import * as Astronomy from 'astronomy-engine';
import type { EclipseSeason } from '@/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const ECLIPSE_SEASON_HALF_LENGTH_DAYS = 17.25;
const ECLIPSE_CLUSTER_GAP_DAYS = 40;

function collectEclipsePeaks(startDate: Date, endDate: Date): Date[] {
  const peaks: Date[] = [];

  let lunar = Astronomy.SearchLunarEclipse(startDate);
  while (lunar.peak.date <= endDate) {
    peaks.push(lunar.peak.date);
    lunar = Astronomy.NextLunarEclipse(lunar.peak);
  }

  let solar = Astronomy.SearchGlobalSolarEclipse(startDate);
  while (solar.peak.date <= endDate) {
    peaks.push(solar.peak.date);
    solar = Astronomy.NextGlobalSolarEclipse(solar.peak);
  }

  return peaks.sort((a, b) => a.getTime() - b.getTime());
}

function findClosestMoonNode(center: Date): Astronomy.NodeEventInfo {
  const searchStart = new Date(center.getTime() - 15 * DAY_MS);
  let closest = Astronomy.SearchMoonNode(searchStart);
  let node = closest;

  for (let index = 0; index < 3; index++) {
    if (
      Math.abs(node.time.date.getTime() - center.getTime()) <
      Math.abs(closest.time.date.getTime() - center.getTime())
    ) {
      closest = node;
    }
    node = Astronomy.NextMoonNode(node);
  }

  return closest;
}

function buildSeason(peaks: Date[], referenceDate: Date): EclipseSeason {
  const centerMs = (peaks[0].getTime() + peaks[peaks.length - 1].getTime()) / 2;
  const center = new Date(centerMs);
  const windowStart = new Date(centerMs - ECLIPSE_SEASON_HALF_LENGTH_DAYS * DAY_MS);
  const windowEnd = new Date(centerMs + ECLIPSE_SEASON_HALF_LENGTH_DAYS * DAY_MS);
  const closestNode = findClosestMoonNode(center);

  return {
    nodeType: closestNode.kind === Astronomy.NodeEventKind.Ascending ? 'ascending' : 'descending',
    nodeCrossingTime: closestNode.time.date,
    windowStart,
    windowEnd,
    isActive: referenceDate >= windowStart && referenceDate <= windowEnd,
  };
}

function calculateSeasons(startDate: Date, endDate: Date, referenceDate: Date): EclipseSeason[] {
  const extendedStart = new Date(startDate.getTime() - 60 * DAY_MS);
  const extendedEnd = new Date(endDate.getTime() + 60 * DAY_MS);
  const peaks = collectEclipsePeaks(extendedStart, extendedEnd);
  const clusters: Date[][] = [];

  for (const peak of peaks) {
    const cluster = clusters[clusters.length - 1];
    const previousPeak = cluster?.[cluster.length - 1];
    if (!cluster || peak.getTime() - previousPeak.getTime() > ECLIPSE_CLUSTER_GAP_DAYS * DAY_MS) {
      clusters.push([peak]);
    } else {
      cluster.push(peak);
    }
  }

  return clusters
    .map(cluster => buildSeason(cluster, referenceDate))
    .filter(season => season.windowEnd >= startDate && season.windowStart <= endDate);
}

/** Return the active eclipse season, or the next upcoming season. */
export function getEclipseSeasonInfo(date: Date): EclipseSeason | null {
  const endDate = new Date(date.getTime() + 240 * DAY_MS);
  const seasons = calculateSeasons(date, endDate, date);
  return seasons.find(season => season.isActive) ?? seasons[0] ?? null;
}

/** Return distinct eclipse seasons whose windows overlap the requested range. */
export function getUpcomingEclipseSeasons(
  startDate: Date,
  windowDays: number = 90
): EclipseSeason[] {
  const endDate = new Date(startDate.getTime() + windowDays * DAY_MS);
  return calculateSeasons(startDate, endDate, startDate);
}

export function isInEclipseSeason(date: Date): boolean {
  return getEclipseSeasonInfo(date)?.isActive ?? false;
}

function formatMonthDay(date: Date, timezone?: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    ...(timezone ? { timeZone: timezone } : {}),
  }).format(date);
}

export function getEclipseSeasonDescription(
  season: EclipseSeason,
  referenceDate: Date,
  timezone?: string
): string {
  if (season.isActive) {
    const start = formatMonthDay(season.windowStart, timezone);
    const end = formatMonthDay(season.windowEnd, timezone);
    return `Eclipse Season Active: ${start} - ${end}`;
  }

  const daysToSeason = Math.ceil((season.windowStart.getTime() - referenceDate.getTime()) / DAY_MS);
  if (daysToSeason >= 0 && daysToSeason <= 30) {
    const start = formatMonthDay(season.windowStart, timezone);
    return `Eclipse Season begins ${start} (${daysToSeason} days)`;
  }
  return '';
}

/** Preserve node-crossing information as a separate lunar-orbit event. */
export function getNextNodeCrossing(date: Date): {
  time: Date;
  nodeType: 'ascending' | 'descending';
  daysUntil: number;
} | null {
  try {
    const node = Astronomy.SearchMoonNode(date);
    return {
      time: node.time.date,
      nodeType: node.kind === Astronomy.NodeEventKind.Ascending ? 'ascending' : 'descending',
      daysUntil: (node.time.date.getTime() - date.getTime()) / DAY_MS,
    };
  } catch {
    return null;
  }
}
