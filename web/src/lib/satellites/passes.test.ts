import { describe, expect, it } from 'vitest';
import { azimuthToCompass, formatPassDuration } from './passes';

describe('Satellite pass utilities', () => {
  describe('azimuthToCompass', () => {
    it('returns N for 0 degrees', () => {
      expect(azimuthToCompass(0)).toBe('N');
    });

    it('returns E for 90 degrees', () => {
      expect(azimuthToCompass(90)).toBe('E');
    });

    it('returns S for 180 degrees', () => {
      expect(azimuthToCompass(180)).toBe('S');
    });

    it('returns W for 270 degrees', () => {
      expect(azimuthToCompass(270)).toBe('W');
    });

    it('returns NE for 45 degrees', () => {
      expect(azimuthToCompass(45)).toBe('NE');
    });

    it('handles values over 360', () => {
      expect(azimuthToCompass(360)).toBe('N');
      expect(azimuthToCompass(450)).toBe('E');
    });
  });

  describe('formatPassDuration', () => {
    it('formats seconds only', () => {
      expect(formatPassDuration(30)).toBe('30s');
    });

    it('formats minutes and seconds', () => {
      expect(formatPassDuration(90)).toBe('1m 30s');
    });

    it('formats exact minutes', () => {
      expect(formatPassDuration(300)).toBe('5m 0s');
    });

    it('handles zero', () => {
      expect(formatPassDuration(0)).toBe('0s');
    });
  });
});
