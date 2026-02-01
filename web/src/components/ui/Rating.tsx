/**
 * Rating Component
 * Displays a unified rating with stars and/or label using the app's rating system
 */

import { getRatingFromScore, type RatingDisplay } from '@/lib/utils/rating';

interface RatingProps {
  /** The score value */
  score: number;
  /** Maximum possible score (default 100) */
  maxScore?: number;
  /** Whether to show the text label (default true) */
  showLabel?: boolean;
  /** Whether to show the star string (default true) */
  showStars?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Optional class name */
  className?: string;
}

/**
 * Size-based styling
 */
const SIZE_CLASSES = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
} as const;

/**
 * Rating component for consistent display of scores with stars and labels
 *
 * @example
 * // Basic usage
 * <Rating score={150} maxScore={200} />
 *
 * @example
 * // Stars only
 * <Rating score={75} showLabel={false} />
 *
 * @example
 * // Label only
 * <Rating score={nightQuality} showStars={false} />
 */
export default function Rating({
  score,
  maxScore = 100,
  showLabel = true,
  showStars = true,
  size = 'md',
  className = '',
}: RatingProps) {
  const rating: RatingDisplay = getRatingFromScore(score, maxScore);
  const sizeClass = SIZE_CLASSES[size];

  // If neither stars nor label, show nothing
  if (!showStars && !showLabel) {
    return null;
  }

  return (
    <span className={`font-medium ${rating.color} ${sizeClass} ${className}`}>
      {showStars && <span className="star-rating">{rating.starString}</span>}
      {showStars && showLabel && ' '}
      {showLabel && rating.label}
    </span>
  );
}

/**
 * Compact rating display - just stars with color
 */
export function RatingStars({
  score,
  maxScore = 100,
  size = 'md',
  className = '',
}: Omit<RatingProps, 'showLabel' | 'showStars'>) {
  return (
    <Rating
      score={score}
      maxScore={maxScore}
      showLabel={false}
      showStars={true}
      size={size}
      className={className}
    />
  );
}

/**
 * Label-only rating display
 */
export function RatingLabel({
  score,
  maxScore = 100,
  size = 'md',
  className = '',
}: Omit<RatingProps, 'showLabel' | 'showStars'>) {
  return (
    <Rating
      score={score}
      maxScore={maxScore}
      showLabel={true}
      showStars={false}
      size={size}
      className={className}
    />
  );
}
