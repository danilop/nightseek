import type { DSOSubtype, ScoredObject, TonightPick } from '@/types';

function formatMagnitude(mag: number | null): string {
  return mag !== null ? `mag ${mag.toFixed(1)}` : '';
}

function isPlanet(obj: ScoredObject): boolean {
  return obj.category === 'planet';
}

function isComet(obj: ScoredObject): boolean {
  return obj.category === 'comet';
}

const GALAXY_SUBTYPES: Set<DSOSubtype> = new Set([
  'galaxy',
  'galaxy_pair',
  'galaxy_triplet',
  'galaxy_group',
]);

const NEBULA_SUBTYPES: Set<DSOSubtype> = new Set([
  'emission_nebula',
  'reflection_nebula',
  'planetary_nebula',
  'supernova_remnant',
  'nebula',
  'hii_region',
  'dark_nebula',
  'cluster_nebula',
]);

const CLUSTER_SUBTYPES: Set<DSOSubtype> = new Set(['open_cluster', 'globular_cluster']);

function isGalaxy(obj: ScoredObject): boolean {
  return obj.category === 'dso' && obj.subtype !== null && GALAXY_SUBTYPES.has(obj.subtype);
}

function isNebula(obj: ScoredObject): boolean {
  return obj.category === 'dso' && obj.subtype !== null && NEBULA_SUBTYPES.has(obj.subtype);
}

function isCluster(obj: ScoredObject): boolean {
  return obj.category === 'dso' && obj.subtype !== null && CLUSTER_SUBTYPES.has(obj.subtype);
}

function pickBest(
  objects: ScoredObject[],
  filter: (obj: ScoredObject) => boolean,
  minScore: number,
  categoryLabel: string,
  pickedNames: Set<string>
): TonightPick | null {
  const best = objects
    .filter(obj => filter(obj) && !pickedNames.has(obj.objectName))
    .sort((a, b) => b.totalScore - a.totalScore)[0];

  if (best && best.totalScore >= minScore) {
    pickedNames.add(best.objectName);
    return {
      object: best,
      categoryLabel,
      reason: best.reason,
      keyStat: formatMagnitude(best.magnitude),
    };
  }
  return null;
}

export function selectTonightPicks(objects: ScoredObject[]): TonightPick[] {
  const picks: TonightPick[] = [];
  const pickedNames = new Set<string>();

  // Top Planet: highest-scoring planet with score >= 60
  const planet = pickBest(objects, isPlanet, 60, 'Top Planet', pickedNames);
  if (planet) picks.push(planet);

  // Top Galaxy: highest-scoring galaxy with score >= 60
  const galaxy = pickBest(objects, isGalaxy, 60, 'Top Galaxy', pickedNames);
  if (galaxy) picks.push(galaxy);

  // Top Nebula: highest-scoring nebula with score >= 60
  const nebula = pickBest(objects, isNebula, 60, 'Top Nebula', pickedNames);
  if (nebula) picks.push(nebula);

  // Top Cluster: highest-scoring cluster with score >= 60
  const cluster = pickBest(objects, isCluster, 60, 'Top Cluster', pickedNames);
  if (cluster) picks.push(cluster);

  // Top Comet: highest-scoring comet with score >= 80
  const comet = pickBest(objects, isComet, 80, 'Top Comet', pickedNames);
  if (comet) picks.push(comet);

  return picks;
}
