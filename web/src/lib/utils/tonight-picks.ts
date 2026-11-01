import type { ScoredObject, TonightPick } from '@/types';
import { compareTargetScores } from '../scoring';
import { getTargetCategory } from './target-category';

function formatMagnitude(mag: number | null): string {
  return mag === null ? '' : `mag ${mag.toFixed(1)}`;
}

function pickBest(
  objects: ScoredObject[],
  filter: (obj: ScoredObject) => boolean,
  minScore: number,
  categoryLabel: string,
  pickedNames: Set<string>
): TonightPick | null {
  const best = objects.find(obj => filter(obj) && !pickedNames.has(obj.objectName));

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
  const ranked = [...objects].sort(compareTargetScores);
  const picks: TonightPick[] = [];
  const pickedNames = new Set<string>();

  // Top Planet: highest-scoring planet with score >= 60
  const planet = pickBest(
    ranked,
    obj => getTargetCategory(obj) === 'planets',
    60,
    'Top Planet',
    pickedNames
  );
  if (planet) picks.push(planet);

  // Top Galaxy: highest-scoring galaxy with score >= 60
  const galaxy = pickBest(
    ranked,
    obj => getTargetCategory(obj) === 'galaxies',
    60,
    'Top Galaxy',
    pickedNames
  );
  if (galaxy) picks.push(galaxy);

  // Top Nebula: highest-scoring nebula with score >= 60
  const nebula = pickBest(
    ranked,
    obj => getTargetCategory(obj) === 'nebulae',
    60,
    'Top Nebula',
    pickedNames
  );
  if (nebula) picks.push(nebula);

  // Top Cluster: highest-scoring cluster with score >= 60
  const cluster = pickBest(
    ranked,
    obj => getTargetCategory(obj) === 'clusters',
    60,
    'Top Cluster',
    pickedNames
  );
  if (cluster) picks.push(cluster);

  // Top Comet: highest-scoring comet with score >= 80
  const comet = pickBest(
    ranked,
    obj => getTargetCategory(obj) === 'comets',
    80,
    'Top Comet',
    pickedNames
  );
  if (comet) picks.push(comet);

  return picks;
}
