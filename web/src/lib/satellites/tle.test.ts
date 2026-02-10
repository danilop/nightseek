import { describe, expect, it } from 'vitest';
import { parseTLEText } from './tle';

describe('TLE parsing', () => {
  const SAMPLE_TLE = `ISS (ZARYA)
1 25544U 98067A   26040.51890046  .00018555  00000+0  33094-3 0  9993
2 25544  51.6413 273.8880 0006089 279.5936  80.4493 15.49973439489959
TIANGONG
1 48274U 21035A   26040.18403660  .00021890  00000+0  25416-3 0  9990
2 48274  41.4728 258.1277 0004756  71.6474  20.2095 15.61885640289123`;

  it('parses multiple TLE entries', () => {
    const result = parseTLEText(SAMPLE_TLE);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('ISS (ZARYA)');
    expect(result[0].noradId).toBe(25544);
    expect(result[1].name).toBe('TIANGONG');
    expect(result[1].noradId).toBe(48274);
  });

  it('extracts line1 and line2 correctly', () => {
    const result = parseTLEText(SAMPLE_TLE);
    expect(result[0].line1).toMatch(/^1 25544/);
    expect(result[0].line2).toMatch(/^2 25544/);
  });

  it('returns empty array for empty input', () => {
    expect(parseTLEText('')).toEqual([]);
  });

  it('skips entries with invalid line prefixes', () => {
    const badTLE = `SATELLITE
INVALID LINE 1
INVALID LINE 2
ISS (ZARYA)
1 25544U 98067A   26040.51890046  .00018555  00000+0  33094-3 0  9993
2 25544  51.6413 273.8880 0006089 279.5936  80.4493 15.49973439489959`;
    const result = parseTLEText(badTLE);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('ISS (ZARYA)');
  });

  it('handles single satellite', () => {
    const single = `HUBBLE
1 20580U 90037B   26040.12345678  .00001234  00000+0  12345-3 0  9999
2 20580  28.4700 123.4567 0002345 123.4567 234.5678 15.09876543210123`;
    const result = parseTLEText(single);
    expect(result).toHaveLength(1);
    expect(result[0].noradId).toBe(20580);
  });

  it('handles input with fewer than 3 lines', () => {
    expect(parseTLEText('just one line')).toEqual([]);
    expect(parseTLEText('line1\nline2')).toEqual([]);
  });
});
