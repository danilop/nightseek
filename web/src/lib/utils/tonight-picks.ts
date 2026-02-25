import type { ScoredObject, TonightPick } from '@/types';

function formatMagnitude(mag: number | null): string {
  return mag !== null ? `mag ${mag.toFixed(1)}` : '';
}

function formatQuality(qualityScore: number): string {
  if (qualityScore >= 90) return 'Excellent';
  if (qualityScore >= 70) return 'Good';
  if (qualityScore >= 50) return 'Acceptable';
  return 'Fair';
}

function isPlanet(obj: ScoredObject): boolean {
  return obj.category === 'planet';
}

function isDSO(obj: ScoredObject): boolean {
  return obj.category === 'dso';
}

function isComet(obj: ScoredObject): boolean {
  return obj.category === 'comet';
}

export function selectTonightPicks(objects: ScoredObject[]): TonightPick[] {
  const picks: TonightPick[] = [];
  const pickedNames = new Set<string>();

  // Top Planet: highest-scoring planet with score >= 60
  const topPlanet = objects.filter(isPlanet).sort((a, b) => b.totalScore - a.totalScore)[0];
  if (topPlanet && topPlanet.totalScore >= 60) {
    picks.push({
      object: topPlanet,
      categoryLabel: 'Top Planet',
      reason: topPlanet.reason,
      keyStat: formatMagnitude(topPlanet.magnitude),
    });
    pickedNames.add(topPlanet.objectName);
  }

  // Top Deep Sky: highest-scoring DSO with score >= 60
  const topDSO = objects.filter(isDSO).sort((a, b) => b.totalScore - a.totalScore)[0];
  if (topDSO && topDSO.totalScore >= 60) {
    picks.push({
      object: topDSO,
      categoryLabel: 'Top Deep Sky',
      reason: topDSO.reason,
      keyStat: formatMagnitude(topDSO.magnitude),
    });
    pickedNames.add(topDSO.objectName);
  }

  // Top Comet: highest-scoring comet with score >= 80
  const topComet = objects.filter(isComet).sort((a, b) => b.totalScore - a.totalScore)[0];
  if (topComet && topComet.totalScore >= 80) {
    picks.push({
      object: topComet,
      categoryLabel: 'Top Comet',
      reason: topComet.reason,
      keyStat: formatMagnitude(topComet.magnitude),
    });
    pickedNames.add(topComet.objectName);
  }

  // Best Imaging: highest qualityScore, not already picked
  const bestImaging = objects
    .filter(
      obj =>
        obj.visibility.imagingWindow != null &&
        obj.visibility.imagingWindow.qualityScore >= 70 &&
        !pickedNames.has(obj.objectName)
    )
    .sort(
      (a, b) =>
        (b.visibility.imagingWindow?.qualityScore ?? 0) -
        (a.visibility.imagingWindow?.qualityScore ?? 0)
    )[0];
  if (bestImaging) {
    const qs = bestImaging.visibility.imagingWindow?.qualityScore ?? 0;
    picks.push({
      object: bestImaging,
      categoryLabel: 'Best Imaging',
      reason: bestImaging.reason,
      keyStat: formatQuality(qs),
    });
  }

  return picks;
}
