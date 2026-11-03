import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  calculateFOVSuitabilityScore,
  calculateFrameFillPercent,
  calculateTotalScore,
} from '@/lib/scoring';
import { getFramePresentation } from '@/lib/utils/target-presentation';
import { createMockNightInfo, createMockObjectVisibility } from '@/test/factories';
import { resolveCatalogDimensions } from './dimensions';
import { loadOpenNGCCatalog } from './opengc';

vi.mock('../utils/cache', async importOriginal => ({
  ...(await importOriginal<typeof import('../utils/cache')>()),
  getCached: vi.fn().mockResolvedValue(null),
  setCache: vi.fn(),
}));
afterEach(() => vi.unstubAllGlobals());

const mini = { width: 128, height: 72 };
describe('region-specific sourced catalogue dimensions', () => {
  it('uses two references for the Western Veil filament and keeps area distinct from span', () => {
    const corrected = resolveCatalogDimensions('NGC6960', 210, 160);
    expect(corrected).toMatchObject({ major: 70, minor: 6, corrected: true });
    expect(corrected.provenance.sources).toHaveLength(2);
    expect(new Set(corrected.provenance.sources.map(s => new URL(s.url).hostname)).size).toBe(2);
    expect(calculateFrameFillPercent(70, 'dso', mini, 6)).toBeCloseTo(3.5793);
    const frame = getFramePresentation(70, 6, 'dso', mini);
    expect(frame?.label).toBe('Fits in frame');
    expect(frame?.geometry?.spanFraction).toBeCloseTo(0.546875);
    expect(calculateFOVSuitabilityScore(70, 'dso', mini, 6)).toBeGreaterThanOrEqual(10);
    const score = calculateTotalScore(
      createMockObjectVisibility({ angularSizeArcmin: 70, minorAxisArcmin: 6 }),
      createMockNightInfo(),
      null,
      12,
      [],
      null,
      null,
      mini
    );
    expect(score.scoreBreakdown.framingPenalty).toBeGreaterThan(-score.totalScore / 2);
  });
  it('corrects North America without combining the Eastern Veil components', () => {
    expect(resolveCatalogDimensions('NGC7000', 120, 30)).toMatchObject({
      major: 120,
      minor: 100,
      corrected: true,
    });
    expect(resolveCatalogDimensions('NGC6992', 60, 8)).toMatchObject({
      major: 60,
      minor: 8,
      corrected: false,
    });
    expect(resolveCatalogDimensions('NGC6995', 12, 12)).toMatchObject({
      major: 12,
      minor: 12,
      corrected: false,
    });
  });
  it('rejects invalid axes and preserves an unknown width', () => {
    expect(resolveCatalogDimensions('NGC1', Number.NaN, -2)).toMatchObject({
      major: null,
      minor: null,
    });
    expect(resolveCatalogDimensions('NGC1', 10, null)).toMatchObject({ major: 10, minor: null });
    expect(resolveCatalogDimensions('NGC1', 5, 10)).toMatchObject({ major: 10, minor: 5 });
  });
});

it('propagates sourced dimensions through ingestion without inventing surface brightness', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          [
            'Name;Type;RA;Dec;V-Mag;B-Mag;MajAx;MinAx;Const;M;Common names',
            'NGC6960;SNR;20:45:38;+30:42:30;;7;210;160;Cyg;;Western Veil',
            'NGC7000;HII;20:58:48;+44:20:00;;4;120;30;Cyg;;North America Nebula',
          ].join('\n')
        )
      )
  );
  const rows = await loadOpenNGCCatalog();
  for (const [name, major, minor] of [
    ['NGC6960', 70, 6],
    ['NGC7000', 120, 100],
  ] as const) {
    const row = rows.find(r => r.name === name);
    expect(row).toMatchObject({
      majorAxisArcmin: major,
      minorAxisArcmin: minor,
      surfaceBrightness: null,
    });
    expect(row?.dimensionProvenance?.sources).toHaveLength(2);
  }
});
