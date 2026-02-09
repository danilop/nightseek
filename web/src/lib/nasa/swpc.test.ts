import { describe, expect, it } from 'vitest';
import type { SWPCData } from './swpc';
import {
  getCurrentKp,
  getRecentMaxKp,
  getSolarActivityLabel,
  getTodayFlareProbability,
} from './swpc';

function makeSWPCData(overrides?: Partial<SWPCData>): SWPCData {
  return {
    kpIndex: [
      { timeTag: new Date().toISOString(), kpIndex: 3, estimatedKp: 3, kpSource: 'SWPC' },
      { timeTag: new Date().toISOString(), kpIndex: 5, estimatedKp: 5, kpSource: 'SWPC' },
    ],
    flareProbabilities: [
      { dateRange: 'today', cClassProbability: 50, mClassProbability: 20, xClassProbability: 5 },
    ],
    sunspotRegions: [],
    solarFlux: { timeTag: new Date().toISOString(), flux: 130 },
    fetchedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('SWPC utilities', () => {
  describe('getCurrentKp', () => {
    it('returns the last Kp reading', () => {
      const data = makeSWPCData();
      expect(getCurrentKp(data)).toBe(5);
    });

    it('returns 0 for empty Kp array', () => {
      const data = makeSWPCData({ kpIndex: [] });
      expect(getCurrentKp(data)).toBe(0);
    });
  });

  describe('getRecentMaxKp', () => {
    it('returns max Kp from recent readings', () => {
      const data = makeSWPCData();
      expect(getRecentMaxKp(data)).toBe(5);
    });

    it('returns 0 for empty array', () => {
      const data = makeSWPCData({ kpIndex: [] });
      expect(getRecentMaxKp(data)).toBe(0);
    });

    it('falls back to last reading if all are outside 24h window', () => {
      const oldTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const data = makeSWPCData({
        kpIndex: [{ timeTag: oldTime, kpIndex: 7, estimatedKp: 7, kpSource: 'SWPC' }],
      });
      // Since the reading is older than 24h, it won't match the cutoff,
      // but it falls back to the last reading
      expect(getRecentMaxKp(data)).toBe(7);
    });
  });

  describe('getSolarActivityLabel', () => {
    it('returns correct labels for flux values', () => {
      expect(getSolarActivityLabel(null)).toBe('low');
      expect(getSolarActivityLabel(80)).toBe('low');
      expect(getSolarActivityLabel(120)).toBe('moderate');
      expect(getSolarActivityLabel(160)).toBe('high');
      expect(getSolarActivityLabel(250)).toBe('very high');
    });
  });

  describe('getTodayFlareProbability', () => {
    it('returns the first entry', () => {
      const data = makeSWPCData();
      const result = getTodayFlareProbability(data);
      expect(result).not.toBeNull();
      expect(result!.mClassProbability).toBe(20);
      expect(result!.xClassProbability).toBe(5);
    });

    it('returns null for empty probabilities', () => {
      const data = makeSWPCData({ flareProbabilities: [] });
      expect(getTodayFlareProbability(data)).toBeNull();
    });
  });
});
