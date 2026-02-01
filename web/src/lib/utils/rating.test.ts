import { describe, expect, it } from 'vitest';
import {
  getRatingColorClass,
  getRatingFromPercentage,
  getRatingFromScore,
  getStarString,
  getTierConfig,
  getTierFromPercentage,
  normalizeScore,
  type RatingTier,
} from './rating';

describe('rating utilities', () => {
  describe('getStarString', () => {
    it('should return 5 filled stars for max rating', () => {
      expect(getStarString(5)).toBe('★★★★★');
    });

    it('should return 1 filled and 4 empty stars for rating of 1', () => {
      expect(getStarString(1)).toBe('★☆☆☆☆');
    });

    it('should return mixed stars for rating of 3', () => {
      expect(getStarString(3)).toBe('★★★☆☆');
    });

    it('should return all empty stars for 0', () => {
      expect(getStarString(0)).toBe('☆☆☆☆☆');
    });

    it('should support custom max stars', () => {
      expect(getStarString(3, 3)).toBe('★★★');
      expect(getStarString(2, 4)).toBe('★★☆☆');
    });

    it('should round to nearest integer', () => {
      expect(getStarString(2.7)).toBe('★★★☆☆');
      expect(getStarString(2.3)).toBe('★★☆☆☆');
    });

    it('should clamp values to valid range', () => {
      expect(getStarString(-1)).toBe('☆☆☆☆☆');
      expect(getStarString(10)).toBe('★★★★★');
    });
  });

  describe('getTierFromPercentage', () => {
    it('should return excellent for >= 75', () => {
      expect(getTierFromPercentage(75)).toBe('excellent');
      expect(getTierFromPercentage(100)).toBe('excellent');
    });

    it('should return very_good for >= 50 and < 75', () => {
      expect(getTierFromPercentage(50)).toBe('very_good');
      expect(getTierFromPercentage(74)).toBe('very_good');
    });

    it('should return good for >= 35 and < 50', () => {
      expect(getTierFromPercentage(35)).toBe('good');
      expect(getTierFromPercentage(49)).toBe('good');
    });

    it('should return fair for >= 20 and < 35', () => {
      expect(getTierFromPercentage(20)).toBe('fair');
      expect(getTierFromPercentage(34)).toBe('fair');
    });

    it('should return poor for < 20', () => {
      expect(getTierFromPercentage(19)).toBe('poor');
      expect(getTierFromPercentage(0)).toBe('poor');
    });
  });

  describe('getRatingFromPercentage', () => {
    it('should return complete rating display for excellent', () => {
      const rating = getRatingFromPercentage(80);
      expect(rating.tier).toBe('excellent');
      expect(rating.stars).toBe(5);
      expect(rating.label).toBe('Excellent');
      expect(rating.color).toBe('text-green-400');
      expect(rating.starString).toBe('★★★★★');
    });

    it('should return complete rating display for poor', () => {
      const rating = getRatingFromPercentage(10);
      expect(rating.tier).toBe('poor');
      expect(rating.stars).toBe(1);
      expect(rating.label).toBe('Poor');
      expect(rating.color).toBe('text-blue-400');
      expect(rating.starString).toBe('★☆☆☆☆');
    });

    it('should return correct colors for each tier', () => {
      expect(getRatingFromPercentage(80).color).toBe('text-green-400'); // excellent
      expect(getRatingFromPercentage(60).color).toBe('text-yellow-400'); // very_good
      expect(getRatingFromPercentage(40).color).toBe('text-orange-400'); // good
      expect(getRatingFromPercentage(25).color).toBe('text-red-400'); // fair
      expect(getRatingFromPercentage(10).color).toBe('text-blue-400'); // poor
    });
  });

  describe('getRatingFromScore', () => {
    it('should normalize score with default maxScore of 100', () => {
      const rating = getRatingFromScore(80);
      expect(rating.tier).toBe('excellent');
    });

    it('should normalize score with custom maxScore', () => {
      const rating = getRatingFromScore(150, 200);
      expect(rating.tier).toBe('excellent'); // 75%
    });

    it('should handle score of 0', () => {
      const rating = getRatingFromScore(0, 100);
      expect(rating.tier).toBe('poor');
    });

    it('should handle maxScore of 0', () => {
      const rating = getRatingFromScore(50, 0);
      expect(rating.tier).toBe('poor');
    });

    it('should correctly convert 200 scale scores', () => {
      // Test the 0-200 scoring scale used in the app
      expect(getRatingFromScore(150, 200).tier).toBe('excellent'); // 75%
      expect(getRatingFromScore(100, 200).tier).toBe('very_good'); // 50%
      expect(getRatingFromScore(70, 200).tier).toBe('good'); // 35%
      expect(getRatingFromScore(40, 200).tier).toBe('fair'); // 20%
      expect(getRatingFromScore(30, 200).tier).toBe('poor'); // 15%
    });
  });

  describe('getTierConfig', () => {
    it('should return correct config for each tier', () => {
      const tiers: RatingTier[] = ['excellent', 'very_good', 'good', 'fair', 'poor'];

      for (const tier of tiers) {
        const config = getTierConfig(tier);
        expect(config).toHaveProperty('stars');
        expect(config).toHaveProperty('label');
        expect(config).toHaveProperty('color');
      }
    });

    it('should match star count to tier', () => {
      expect(getTierConfig('excellent').stars).toBe(5);
      expect(getTierConfig('very_good').stars).toBe(4);
      expect(getTierConfig('good').stars).toBe(3);
      expect(getTierConfig('fair').stars).toBe(2);
      expect(getTierConfig('poor').stars).toBe(1);
    });
  });

  describe('normalizeScore', () => {
    it('should normalize to 0-100 range', () => {
      expect(normalizeScore(100, 200)).toBe(50);
      expect(normalizeScore(150, 200)).toBe(75);
      expect(normalizeScore(200, 200)).toBe(100);
    });

    it('should clamp values to 0-100', () => {
      expect(normalizeScore(250, 200)).toBe(100);
      expect(normalizeScore(-50, 200)).toBe(0);
    });

    it('should handle maxScore of 0', () => {
      expect(normalizeScore(50, 0)).toBe(0);
    });
  });

  describe('getRatingColorClass', () => {
    it('should return correct color class for each tier', () => {
      expect(getRatingColorClass('excellent')).toBe('text-green-400');
      expect(getRatingColorClass('very_good')).toBe('text-yellow-400');
      expect(getRatingColorClass('good')).toBe('text-orange-400');
      expect(getRatingColorClass('fair')).toBe('text-red-400');
      expect(getRatingColorClass('poor')).toBe('text-blue-400');
    });
  });

  describe('color scale progression', () => {
    it('should follow blue → red → orange → yellow → green progression', () => {
      // This test documents the intentional color scale from worst to best
      const colors = [
        getRatingFromPercentage(10).color, // poor
        getRatingFromPercentage(25).color, // fair
        getRatingFromPercentage(40).color, // good
        getRatingFromPercentage(60).color, // very_good
        getRatingFromPercentage(80).color, // excellent
      ];

      expect(colors).toEqual([
        'text-blue-400', // poor (worst)
        'text-red-400', // fair
        'text-orange-400', // good
        'text-yellow-400', // very_good
        'text-green-400', // excellent (best)
      ]);
    });
  });
});
