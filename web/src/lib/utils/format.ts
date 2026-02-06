import { format, formatInTimeZone } from 'date-fns-tz';
import type { ScoreTier } from '@/types';

/**
 * Format time in local timezone
 */
export function formatTime(date: Date, timezone?: string): string {
  if (timezone) {
    return formatInTimeZone(date, timezone, 'h:mm a');
  }
  return format(date, 'h:mm a');
}

/**
 * Format time range with en-dash separator (e.g., "10:30 PM – 2:45 AM")
 */
export function formatTimeRange(start: Date, end: Date, timezone?: string): string {
  return `${formatTime(start, timezone)} – ${formatTime(end, timezone)}`;
}

/**
 * Format date for display
 */
export function formatDate(date: Date, timezone?: string): string {
  if (timezone) {
    return formatInTimeZone(date, timezone, 'EEE, MMM d');
  }
  return format(date, 'EEE, MMM d');
}

/**
 * Format date range
 */
export function formatDateRange(start: Date, end: Date): string {
  const startStr = format(start, 'MMM d');
  const endStr = format(end, 'MMM d, yyyy');
  return `${startStr} - ${endStr}`;
}

/**
 * Get a label for the night relative to today.
 * Returns "Tonight (Mon 15)" for today, "Tomorrow (Tue 16)" for tomorrow,
 * or "Wednesday (Wed 17)" for other days.
 * Can append "'s" for possessive form (e.g., "Tonight's", "Wednesday's")
 */
export function getNightLabel(date: Date, possessive = false): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dateStr = date.toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // Always include short date for clarity (e.g., "Mon 15")
  const shortDate = format(date, 'EEE d');

  let label: string;
  if (dateStr === todayStr) {
    label = `Tonight (${shortDate})`;
  } else if (dateStr === tomorrowStr) {
    label = `Tomorrow (${shortDate})`;
  } else {
    // For other days, show day name with date
    label = format(date, 'EEEE (EEE d)'); // "Wednesday (Wed 17)"
  }

  if (possessive) {
    // Insert 's before the parenthesis: "Tonight's (Mon 15)"
    return label.replace(' (', "'s (");
  }
  return label;
}

/**
 * Get moon phase emoji
 */
export function getMoonPhaseEmoji(phase: number): string {
  // Phase is 0-1 where 0=new, 0.5=full
  // Convert to 0-8 for 8 moon phases
  const phaseIndex = Math.round(phase * 8) % 8;
  const emojis = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
  return emojis[phaseIndex];
}

/**
 * Get moon phase name
 */
export function getMoonPhaseName(phase: number): string {
  const phaseIndex = Math.round(phase * 8) % 8;
  const names = [
    'New Moon',
    'Waxing Crescent',
    'First Quarter',
    'Waxing Gibbous',
    'Full Moon',
    'Waning Gibbous',
    'Last Quarter',
    'Waning Crescent',
  ];
  return names[phaseIndex];
}

/**
 * Get weather emoji based on cloud cover
 */
export function getWeatherEmoji(cloudCover: number): string {
  if (cloudCover < 10) return '☀️';
  if (cloudCover < 25) return '🌤️';
  if (cloudCover < 40) return '⛅';
  if (cloudCover < 60) return '☁️';
  return '🌧️';
}

/**
 * Get weather description
 */
export function getWeatherDescription(cloudCover: number): string {
  if (cloudCover < 10) return 'Clear';
  if (cloudCover < 25) return 'Mostly Clear';
  if (cloudCover < 40) return 'Partly Cloudy';
  if (cloudCover < 60) return 'Mostly Cloudy';
  return 'Overcast';
}

/**
 * Get object category icon
 */
export function getCategoryIcon(category: string, subtype?: string | null): string {
  if (category === 'planet') return '🪐';
  if (category === 'comet') return '☄️';
  if (category === 'asteroid') return '🪨';
  if (category === 'dwarf_planet') return '🔵';
  if (category === 'milky_way') return '🌌';
  if (category === 'moon') return '🌙';

  // DSO subtypes
  if (subtype === 'galaxy' || subtype?.includes('galaxy')) return '🌀';
  if (subtype?.includes('nebula') || subtype === 'hii_region') return '☁️';
  if (subtype?.includes('cluster')) return '✨';
  if (subtype === 'planetary_nebula') return '💫';
  if (subtype === 'supernova_remnant') return '💥';

  return '🌌';
}

/**
 * Format altitude with quality indicator
 */
export function formatAltitude(altitude: number): string {
  return `${Math.round(altitude)}°`;
}

/**
 * Get altitude quality class
 */
export function getAltitudeQualityClass(altitude: number): string {
  if (altitude >= 75) return 'text-green-400';
  if (altitude >= 60) return 'text-blue-400';
  if (altitude >= 45) return 'text-yellow-400';
  if (altitude >= 30) return 'text-orange-400';
  return 'text-red-400';
}

/**
 * Format score with tier
 */
export function formatScore(score: number, maxScore: number = 220): string {
  return `${score}/${maxScore}`;
}

/**
 * Get tier color class
 *
 * Color Scale (Worst → Best):
 * - Poor: blue-400
 * - Fair: red-400
 * - Good: orange-400
 * - Very Good: yellow-400
 * - Excellent: green-400
 */
export function getTierColorClass(tier: ScoreTier): string {
  switch (tier) {
    case 'excellent':
      return 'text-green-400';
    case 'very_good':
      return 'text-yellow-400';
    case 'good':
      return 'text-orange-400';
    case 'fair':
      return 'text-red-400';
    case 'poor':
      return 'text-blue-400';
  }
}

/**
 * Format magnitude
 */
export function formatMagnitude(magnitude: number | null): string {
  if (magnitude === null) return '—';
  return magnitude.toFixed(1);
}

/**
 * Format angular size
 */
export function formatAngularSize(arcmin: number): string {
  if (arcmin >= 60) {
    return `${(arcmin / 60).toFixed(1)}°`;
  }
  if (arcmin >= 1) {
    return `${arcmin.toFixed(1)}'`;
  }
  return `${(arcmin * 60).toFixed(0)}"`;
}

/**
 * Format moon separation
 */
export function formatMoonSeparation(degrees: number | null): string {
  if (degrees === null) return '—';
  return `${Math.round(degrees)}° from Moon`;
}

/**
 * Get star rating string
 */
export function getStarRating(rating: number, maxStars: number = 5): string {
  const filled = Math.round(rating);
  const empty = maxStars - filled;
  return '★'.repeat(filled) + '☆'.repeat(empty);
}

/**
 * Calculate night quality rating (1-5 stars)
 */
export function calculateNightRating(moonIllumination: number, cloudCover?: number | null): number {
  let rating = 5;

  // Moon penalty
  if (moonIllumination > 80) rating -= 2;
  else if (moonIllumination > 50) rating -= 1;
  else if (moonIllumination > 30) rating -= 0.5;

  // Cloud penalty
  if (cloudCover !== null && cloudCover !== undefined) {
    if (cloudCover > 70) rating -= 2;
    else if (cloudCover > 50) rating -= 1.5;
    else if (cloudCover > 30) rating -= 1;
    else if (cloudCover > 15) rating -= 0.5;
  }

  return Math.max(1, Math.min(5, Math.round(rating)));
}
