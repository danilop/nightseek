/**
 * Unified Rating System
 * Single source of truth for the 5-tier rating scale used across the app
 *
 * Color Scale (Worst → Best):
 * - Poor (1 star): blue-400 #60A5FA
 * - Fair (2 stars): red-400 #F87171
 * - Good (3 stars): orange-400 #FB923C
 * - Very Good (4 stars): yellow-400 #FACC15
 * - Excellent (5 stars): green-400 #4ADE80
 */

export type RatingTier = 'poor' | 'fair' | 'good' | 'very_good' | 'excellent';

export interface RatingDisplay {
  tier: RatingTier;
  stars: number; // 1-5
  label: string; // "Excellent", "Very Good", etc.
  color: string; // Tailwind class
  starString: string; // "★★★★☆"
}

/**
 * Tier thresholds (normalized 0-100 scale)
 */
const THRESHOLDS = {
  excellent: 75,
  very_good: 50,
  good: 35,
  fair: 20,
} as const;

/**
 * Tier configuration with colors and labels
 */
const TIER_CONFIG: Record<RatingTier, { stars: number; label: string; color: string }> = {
  excellent: { stars: 5, label: 'Excellent', color: 'text-green-400' },
  very_good: { stars: 4, label: 'Very Good', color: 'text-yellow-400' },
  good: { stars: 3, label: 'Good', color: 'text-orange-400' },
  fair: { stars: 2, label: 'Fair', color: 'text-red-400' },
  poor: { stars: 1, label: 'Poor', color: 'text-blue-400' },
};

/**
 * Generate star string (filled and empty stars)
 */
export function getStarString(stars: number, maxStars: number = 5): string {
  const filled = Math.max(0, Math.min(maxStars, Math.round(stars)));
  const empty = maxStars - filled;
  return '★'.repeat(filled) + '☆'.repeat(empty);
}

/**
 * Get rating tier from a percentage (0-100)
 */
export function getTierFromPercentage(percent: number): RatingTier {
  if (percent >= THRESHOLDS.excellent) return 'excellent';
  if (percent >= THRESHOLDS.very_good) return 'very_good';
  if (percent >= THRESHOLDS.good) return 'good';
  if (percent >= THRESHOLDS.fair) return 'fair';
  return 'poor';
}

/**
 * Get full rating display from a percentage (0-100)
 */
export function getRatingFromPercentage(percent: number): RatingDisplay {
  const tier = getTierFromPercentage(percent);
  const config = TIER_CONFIG[tier];
  return {
    tier,
    stars: config.stars,
    label: config.label,
    color: config.color,
    starString: getStarString(config.stars),
  };
}

/**
 * Get full rating display from a raw score
 * @param score - The raw score value
 * @param maxScore - Maximum possible score (default 100)
 */
export function getRatingFromScore(score: number, maxScore: number = 100): RatingDisplay {
  const percent = maxScore > 0 ? (score / maxScore) * 100 : 0;
  return getRatingFromPercentage(percent);
}

/**
 * Get tier configuration (for direct tier lookups)
 */
export function getTierConfig(tier: RatingTier): { stars: number; label: string; color: string } {
  return TIER_CONFIG[tier];
}

/**
 * Normalize a score to 0-100 scale
 */
export function normalizeScore(score: number, maxScore: number = 200): number {
  if (maxScore <= 0) return 0;
  return Math.max(0, Math.min(100, (score / maxScore) * 100));
}

/**
 * Get color class for a rating tier
 */
export function getRatingColorClass(tier: RatingTier): string {
  return TIER_CONFIG[tier].color;
}
