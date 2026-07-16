import * as satellite from 'satellite.js';
import { describe, expect, it } from 'vitest';
import {
  azimuthToCompass,
  estimateMagnitude,
  formatPassDuration,
  isSatelliteSunlit,
  normalizeAzimuth,
} from './passes';

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

  describe('normalizeAzimuth', () => {
    it('keeps values in 0-360 range', () => {
      expect(normalizeAzimuth(45)).toBe(45);
      expect(normalizeAzimuth(0)).toBe(0);
      expect(normalizeAzimuth(359.9)).toBe(359.9);
    });

    it('normalizes negative values', () => {
      expect(normalizeAzimuth(-90)).toBe(270);
      expect(normalizeAzimuth(-180)).toBe(180);
      expect(normalizeAzimuth(-1)).toBe(359);
    });

    it('normalizes values over 360', () => {
      expect(normalizeAzimuth(450)).toBe(90);
      expect(normalizeAzimuth(720)).toBe(0);
    });

    it('rounds to one decimal', () => {
      expect(normalizeAzimuth(45.123)).toBe(45.1);
      expect(normalizeAzimuth(45.156)).toBe(45.2);
    });
  });

  describe('estimateMagnitude', () => {
    it('returns base magnitude at zenith', () => {
      expect(estimateMagnitude(90, -3.5)).toBe(-3.5);
    });

    it('returns dimmer at low altitude', () => {
      const atZenith = estimateMagnitude(90, -3.5);
      const atLow = estimateMagnitude(10, -3.5);
      expect(atLow).toBeGreaterThan(atZenith);
    });

    it('returns exactly 2 magnitudes dimmer at 10 degrees', () => {
      expect(estimateMagnitude(10, 0)).toBe(2);
      expect(estimateMagnitude(10, -3.5)).toBe(-1.5);
    });

    it('returns intermediate values for mid-altitude', () => {
      const at50 = estimateMagnitude(50, 0);
      expect(at50).toBeGreaterThan(0);
      expect(at50).toBeLessThan(2);
    });

    it('uses inverse-square range when range is available', () => {
      expect(estimateMagnitude(45, -3, 800, 400)).toBeCloseTo(-1.5, 1);
    });
  });

  describe('Earth shadow', () => {
    const time = new Date('2026-01-15T00:00:00Z');
    const sun = satellite.sunPos(satellite.jday(time)).rsun;
    const length = Math.hypot(...sun);
    const unit = sun.map(value => value / length);

    it('marks a satellite behind the Earth as eclipsed', () => {
      const position = { x: -unit[0] * 7000, y: -unit[1] * 7000, z: -unit[2] * 7000 };
      expect(isSatelliteSunlit(position, time)).toBe(false);
    });

    it('marks a satellite on the sunward side as illuminated', () => {
      const position = { x: unit[0] * 7000, y: unit[1] * 7000, z: unit[2] * 7000 };
      expect(isSatelliteSunlit(position, time)).toBe(true);
    });
  });
});
