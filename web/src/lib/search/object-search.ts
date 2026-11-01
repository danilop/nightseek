import type {
  DSOCatalogEntry,
  HorizonProfile,
  Location,
  NightForecast,
  NightInfo,
  ObjectSearchResult,
  ObjectVisibility,
  ObjectVisibilityStatus,
  ScoredObject,
} from '@/types';
import { SkyCalculator } from '../astronomy/calculator';
import { calculateDSOVisibility } from '../astronomy/dso';
import { PLANETS } from '../astronomy/planets';
import { calculateCometVisibility, fetchComets, type ParsedComet } from '../catalogs/comets';
import {
  calculateMinorPlanetVisibility,
  DWARF_PLANETS,
  type MinorPlanetData,
  NOTABLE_ASTEROIDS,
} from '../catalogs/minor-planets';
import { loadOpenNGCCatalog } from '../catalogs/opengc';
import { firstNightDate, nightDateAtOffset } from '../forecast/night-dates';
import { scoreTargetForNight } from '../scoring/target';
import { formatDateKey } from '../utils/format';
import { createDefaultHorizonProfile, evaluateTargetAccessibility } from '../utils/horizon-profile';
import { matchesMagnitudeLimit } from '../utils/magnitude';
import { getTargetPhotoWindow } from '../utils/target-photo-windows';
import { findFirstMatchingDay } from './search-astronomy';

interface SearchContext {
  magnitudeLimit?: number | null;
  horizonProfile?: HorizonProfile;
  forecasts?: NightForecast[];
  scoredObjects?: Map<string, ScoredObject[]>;
  fov?: { width: number; height: number } | null;
}
interface Candidate {
  name: string;
  messierNumber?: number | null;
  fixedDeclination?: number;
  calculate: (night: NightInfo) => ObjectVisibility | null;
}

interface NightMatch {
  night: NightInfo;
  visibility: ObjectVisibility;
}

async function findAccessibleNight(
  candidate: Candidate,
  calculator: SkyCalculator,
  start: Date,
  timezone: string,
  profile: HorizonProfile
): Promise<NightMatch | null> {
  return findFirstMatchingDay(
    start,
    364,
    date => {
      const night = calculator.getNightInfo(date);
      const visibility = candidate.calculate(night);
      return visibility && evaluateTargetAccessibility(visibility, profile, null).isAccessible
        ? { night, visibility }
        : null;
    },
    timezone
  );
}

async function findOptimalDate(
  candidate: Candidate,
  calculator: SkyCalculator,
  match: NightMatch | null,
  timezone: string,
  profile: HorizonProfile,
  canReach: boolean
): Promise<Date | null> {
  if (!match || !canReach) return null;
  const optimal = { ...profile, minimumAltitude: Math.max(45, profile.minimumAltitude) };
  if (evaluateTargetAccessibility(match.visibility, optimal, null).isAccessible)
    return match.night.date;
  const next = await findAccessibleNight(
    candidate,
    calculator,
    nightDateAtOffset(match.night.date, timezone, 1),
    timezone,
    optimal
  );
  return next?.night.date ?? null;
}

function visibilityStatus(
  neverVisible: boolean,
  visibleTonight: boolean,
  match: NightMatch | null,
  tonight: NightInfo
): ObjectVisibilityStatus {
  if (neverVisible) return 'never_visible';
  if (visibleTonight) return 'visible_tonight';
  if (!match) return 'below_horizon';
  const days = Math.round((match.night.date.getTime() - tonight.date.getTime()) / 86_400_000);
  return days <= 30 ? 'visible_soon' : 'visible_later';
}

function resultMetadata(
  candidate: Candidate,
  visibility: ObjectVisibility,
  maxPossibleAltitude: number
) {
  const fixed = candidate.fixedDeclination !== undefined;
  const canReachOptimal = !fixed || maxPossibleAltitude >= 45;
  return {
    objectName: candidate.name,
    displayName: visibility.commonName || candidate.name,
    objectType: visibility.objectType,
    subtype: visibility.subtype,
    raHours: visibility.raHours,
    decDegrees: visibility.decDegrees,
    magnitude: visibility.magnitude,
    constellation: visibility.constellation ?? null,
    messierNumber: candidate.messierNumber ?? null,
    maxPossibleAltitude,
    isMovingObject: !fixed,
    angularSizeArcmin: visibility.angularSizeArcmin,
    azimuthAtPeak: visibility.azimuthAtPeak,
    canReachOptimal,
    optimalAltitudeNote: canReachOptimal
      ? null
      : `Best altitude from your location: ${maxPossibleAltitude.toFixed(0)}° (never reaches 45°)`,
  };
}

/** One visibility policy for all catalog types, including the saved local horizon. */
async function createSearchResult(
  candidate: Candidate,
  calculator: SkyCalculator,
  tonight: NightInfo,
  timezone: string,
  context: SearchContext,
  now: Date
): Promise<ObjectSearchResult | null> {
  const profile = context.horizonProfile ?? createDefaultHorizonProfile();
  const dateKey = formatDateKey(tonight.date, timezone);
  const cached = context.scoredObjects
    ?.get(dateKey)
    ?.find(object => object.objectName === candidate.name);
  const initial = cached?.visibility ?? candidate.calculate(tonight);
  if (!initial) return null;
  const fixed = candidate.fixedDeclination !== undefined;
  const maxPossibleAltitude =
    90 - Math.abs(calculator.getLatitude() - (candidate.fixedDeclination ?? initial.decDegrees));
  const neverVisible = fixed && maxPossibleAltitude < profile.minimumAltitude;
  const forecast = context.forecasts?.find(
    item => formatDateKey(item.nightInfo.date, timezone) === dateKey
  );
  const accessible = (visibility: ObjectVisibility) =>
    evaluateTargetAccessibility(visibility, profile, null).isAccessible;
  const visibleTonight = !neverVisible && accessible(initial);
  let match: { night: NightInfo; visibility: ObjectVisibility } | null = visibleTonight
    ? { night: tonight, visibility: initial }
    : null;
  if (!neverVisible && !match) {
    match = await findAccessibleNight(
      candidate,
      calculator,
      nightDateAtOffset(tonight.date, timezone, 1),
      timezone,
      profile
    );
  }
  const visibility = match?.visibility ?? initial;
  const canReachOptimal = !fixed || maxPossibleAltitude >= 45;
  const nextOptimalDate = await findOptimalDate(
    candidate,
    calculator,
    match,
    timezone,
    profile,
    canReachOptimal
  );
  // Only forecast-backed ratings are comparable to Targets. Future visibility is geometry only.
  const scored =
    visibleTonight && forecast
      ? (cached ??
        scoreTargetForNight(
          initial,
          tonight,
          forecast.weather,
          calculator,
          forecast.astronomicalEvents,
          context.fov ?? null
        ))
      : undefined;
  const access = evaluateTargetAccessibility(visibility, profile, forecast?.weather ?? null);
  const photoWindow = scored ? getTargetPhotoWindow(scored.visibility, access, now) : null;
  const above45 = evaluateTargetAccessibility(
    visibility,
    { ...profile, minimumAltitude: Math.max(45, profile.minimumAltitude) },
    null
  ).bestWindow;
  return {
    ...resultMetadata(candidate, visibility, maxPossibleAltitude),
    visibilityStatus: visibilityStatus(neverVisible, visibleTonight, match, tonight),
    visibleTonight,
    nextVisibleDate: match?.night.date ?? null,
    nextVisibleNightInfo: match?.night ?? null,
    visibility: match
      ? {
          ...visibility,
          imagingWindow: photoWindow ?? undefined,
          above45Start: above45?.start ?? null,
          above45End: above45?.end ?? null,
        }
      : null,
    totalScore: scored?.totalScore,
    neverVisible,
    neverVisibleReason: neverVisible
      ? `Object only reaches ${maxPossibleAltitude.toFixed(1)}° altitude (below your ${profile.minimumAltitude}° minimum)`
      : null,
    nextOptimalDate,
  };
}

async function searchDSOs(query: string, catalog: DSOCatalogEntry[]): Promise<DSOCatalogEntry[]> {
  const lowerQuery = query.toLowerCase().trim();

  // Handle Messier designations: M1, M 1, m1, m 1, etc.
  const messierMatch = lowerQuery.match(/^m\s*(\d+)$/);
  if (messierMatch) {
    const messierNum = parseInt(messierMatch[1], 10);
    return catalog.filter(entry => entry.messierNumber === messierNum);
  }

  // Handle NGC/IC designations: NGC 224, NGC224, ngc 224, etc.
  const ngcMatch = lowerQuery.match(/^(ngc|ic)\s*(\d+)$/);
  if (ngcMatch) {
    const prefix = ngcMatch[1].toLowerCase();
    const number = Number(ngcMatch[2]);
    return catalog.filter(entry => {
      const designation = entry.name.toLowerCase().match(/^(ngc|ic)\s*(\d+)$/);
      return designation?.[1] === prefix && Number(designation[2]) === number;
    });
  }

  // General search: name, common name, or partial match
  return catalog.filter(entry => {
    if (entry.name.toLowerCase().includes(lowerQuery)) return true;
    if (entry.commonName?.toLowerCase().includes(lowerQuery)) return true;
    return false;
  });
}

/**
 * Search for planets matching the query
 */
function searchPlanets(query: string): string[] {
  const lowerQuery = query.toLowerCase().trim();
  return PLANETS.map(p => p.name).filter(p => p.toLowerCase().includes(lowerQuery));
}

/**
 * Search for comets matching the query
 */
function searchComets(query: string, comets: ParsedComet[]): ParsedComet[] {
  const lowerQuery = query.toLowerCase().trim();
  return comets.filter(
    c =>
      c.designation.toLowerCase().includes(lowerQuery) || c.name.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Search for dwarf planets matching the query
 */
function searchDwarfPlanets(query: string): MinorPlanetData[] {
  const lowerQuery = query.toLowerCase().trim();
  return DWARF_PLANETS.filter(
    dp =>
      dp.name.toLowerCase().includes(lowerQuery) ||
      dp.designation.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Search for asteroids matching the query
 */
function searchAsteroids(query: string): MinorPlanetData[] {
  const lowerQuery = query.toLowerCase().trim();
  return NOTABLE_ASTEROIDS.filter(
    a =>
      a.name.toLowerCase().includes(lowerQuery) || a.designation.toLowerCase().includes(lowerQuery)
  );
}

export async function searchCelestialObjects(
  query: string,
  location: Location,
  maxResults = 20,
  progressCallback?: (message: string) => void,
  referenceDate: Date = new Date(),
  context: SearchContext = {}
): Promise<ObjectSearchResult[]> {
  if (!query.trim() || maxResults <= 0) return [];
  const calculator = new SkyCalculator(location.latitude, location.longitude);
  const timezone = location.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tonight = calculator.getNightInfo(firstNightDate(referenceDate, timezone, calculator));
  const candidates: Candidate[] = searchPlanets(query).map(name => ({
    name,
    calculate: night => calculator.calculatePlanetVisibility(name, night),
  }));
  for (const mp of [...searchDwarfPlanets(query), ...searchAsteroids(query)]) {
    candidates.push({
      name: mp.name,
      calculate: night => calculateMinorPlanetVisibility(mp, calculator, night, Infinity, true),
    });
  }
  progressCallback?.('Searching deep sky objects...');
  try {
    const catalog = await loadOpenNGCCatalog({ maxMagnitude: 20 });
    for (const dso of (await searchDSOs(query, catalog))
      .filter(dso => matchesMagnitudeLimit(dso.magnitude, context.magnitudeLimit ?? null))
      .slice(0, Math.max(0, maxResults - candidates.length))) {
      candidates.push({
        name: dso.name,
        messierNumber: dso.messierNumber,
        fixedDeclination: dso.decDegrees,
        calculate: night => calculateDSOVisibility(dso, calculator, night),
      });
    }
  } catch {
    /* Other catalogs remain available when a source is offline. */
  }
  progressCallback?.('Searching comets...');
  try {
    for (const comet of searchComets(query, await fetchComets(20)).slice(0, 5)) {
      candidates.push({
        name: comet.designation,
        calculate: night => calculateCometVisibility(comet, calculator, night, Infinity, true),
      });
    }
  } catch {
    /* Other catalogs remain available when a source is offline. */
  }
  const results: ObjectSearchResult[] = [];
  for (const candidate of candidates) {
    progressCallback?.(`Checking visibility: ${candidate.name}...`);
    const result = await createSearchResult(
      candidate,
      calculator,
      tonight,
      timezone,
      context,
      referenceDate
    );
    if (result && matchesMagnitudeLimit(result.magnitude, context.magnitudeLimit ?? null))
      results.push(result);
  }
  const statusOrder: Record<ObjectVisibilityStatus, number> = {
    visible_tonight: 0,
    visible_soon: 1,
    visible_later: 2,
    below_horizon: 3,
    never_visible: 4,
  };
  return results
    .sort((a, b) => statusOrder[a.visibilityStatus] - statusOrder[b.visibilityStatus])
    .slice(0, maxResults);
}
