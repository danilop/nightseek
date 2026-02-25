import { describe, expect, it } from 'vitest';
import {
  getCurrentKp,
  getRecentMaxKp,
  getSolarActivityLabel,
  getTodayFlareProbability,
  parseFlareProbabilities,
  parseKpIndex,
  parseSunspotReport,
  type SWPCData,
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
      expect(result?.mClassProbability).toBe(20);
      expect(result?.xClassProbability).toBe(5);
    });

    it('returns null for empty probabilities', () => {
      const data = makeSWPCData({ flareProbabilities: [] });
      expect(getTodayFlareProbability(data)).toBeNull();
    });
  });

  describe('parseKpIndex', () => {
    it('parses valid Kp entries', () => {
      const raw = [
        { time_tag: '2026-02-09T12:00:00Z', kp_index: 3, estimated_kp: 3.2, kp: 3, source: 'NOAA' },
        { time_tag: '2026-02-09T13:00:00Z', kp_index: 5, estimated_kp: 4.8, kp: 5 },
      ];
      const result = parseKpIndex(raw);
      expect(result).toHaveLength(2);
      expect(result[0].kpIndex).toBe(3);
      expect(result[0].kpSource).toBe('NOAA');
      expect(result[1].kpSource).toBe('SWPC');
    });

    it('returns empty array for non-array input', () => {
      expect(parseKpIndex(null as never)).toEqual([]);
      expect(parseKpIndex('bad' as never)).toEqual([]);
    });

    it('filters entries without kp values', () => {
      const raw = [
        {
          time_tag: '2026-02-09T12:00:00Z',
          kp_index: null as unknown as number,
          estimated_kp: 3,
          kp: null as unknown as number,
        },
        { time_tag: '2026-02-09T13:00:00Z', kp_index: 5, estimated_kp: 5, kp: 5 },
      ];
      const result = parseKpIndex(raw);
      expect(result).toHaveLength(1);
    });

    it('falls back from kp_index to kp field', () => {
      const raw = [
        {
          time_tag: '2026-02-09T12:00:00Z',
          kp_index: undefined as unknown as number,
          estimated_kp: 0,
          kp: 7,
        },
      ];
      const result = parseKpIndex(raw);
      expect(result[0].kpIndex).toBe(7);
    });
  });

  describe('parseFlareProbabilities', () => {
    it('parses uppercase field names', () => {
      const raw = [{ DateRange: 'Feb 09', C: 80, M: 30, X: 5 }];
      const result = parseFlareProbabilities(raw);
      expect(result).toHaveLength(1);
      expect(result[0].dateRange).toBe('Feb 09');
      expect(result[0].cClassProbability).toBe(80);
      expect(result[0].mClassProbability).toBe(30);
      expect(result[0].xClassProbability).toBe(5);
    });

    it('parses lowercase field names', () => {
      const raw = [{ 'date-range': 'Feb 10', c_class: 60, m_class: 20, x_class: 2 }];
      const result = parseFlareProbabilities(raw);
      expect(result[0].dateRange).toBe('Feb 10');
      expect(result[0].cClassProbability).toBe(60);
    });

    it('returns empty array for non-array input', () => {
      expect(parseFlareProbabilities(null as never)).toEqual([]);
    });

    it('defaults missing fields to 0', () => {
      const raw = [{}];
      const result = parseFlareProbabilities(raw);
      expect(result[0].cClassProbability).toBe(0);
      expect(result[0].mClassProbability).toBe(0);
      expect(result[0].xClassProbability).toBe(0);
      expect(result[0].dateRange).toBe('');
    });
  });

  describe('parseSunspotReport', () => {
    it('parses uppercase field names', () => {
      const raw = [
        {
          Region: 4001,
          Numspot: 12,
          Zurich: 'Dkc',
          Magtype: 'Beta-Gamma',
          Location: 'N15W30',
          Area: 200,
        },
      ];
      const result = parseSunspotReport(raw);
      expect(result).toHaveLength(1);
      expect(result[0].region).toBe(4001);
      expect(result[0].spotCount).toBe(12);
      expect(result[0].spotClass).toBe('Dkc');
      expect(result[0].magClass).toBe('Beta-Gamma');
    });

    it('parses lowercase field names', () => {
      const raw = [
        { region: 4002, numspot: 5, zurich: 'Eki', magtype: 'Alpha', location: 'S10E20', area: 50 },
      ];
      const result = parseSunspotReport(raw);
      expect(result[0].region).toBe(4002);
      expect(result[0].spotCount).toBe(5);
    });

    it('filters entries without region', () => {
      const raw = [{ Numspot: 5 }, { Region: 4003, Numspot: 3 }];
      const result = parseSunspotReport(raw);
      expect(result).toHaveLength(1);
      expect(result[0].region).toBe(4003);
    });

    it('returns empty array for non-array input', () => {
      expect(parseSunspotReport(null as never)).toEqual([]);
    });

    it('defaults missing fields to zero/empty', () => {
      const raw = [{ Region: 4004 }];
      const result = parseSunspotReport(raw);
      expect(result[0].spotCount).toBe(0);
      expect(result[0].spotClass).toBe('');
      expect(result[0].magClass).toBe('');
      expect(result[0].area).toBe(0);
    });
  });
});
