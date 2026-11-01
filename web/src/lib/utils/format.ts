import { format, formatInTimeZone } from 'date-fns-tz';

/**
 * Format time in local timezone
 */
function offsetMinutes(date: Date, timezone: string): number {
  const offset = formatInTimeZone(date, timezone, 'xxx');
  return (
    (offset[0] === '-' ? -1 : 1) * (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4, 6)))
  );
}

/** Offset changes affect wall-clock labels, never elapsed durations. */
export function clockChangeMinutes(start: Date, end: Date, timezone?: string): number {
  const zone = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  return offsetMinutes(end, zone) - offsetMinutes(start, zone);
}

function isRepeatedLocalTime(date: Date, timezone: string): boolean {
  const offset = offsetMinutes(date, timezone);
  const wallTime = formatInTimeZone(date, timezone, 'yyyy-MM-dd HH:mm:ss');
  return [-86_400_000, 86_400_000].some(distance => {
    const otherOffset = offsetMinutes(new Date(date.getTime() + distance), timezone);
    if (otherOffset === offset) return false;
    const alternative = new Date(date.getTime() + (offset - otherOffset) * 60_000);
    return formatInTimeZone(alternative, timezone, 'yyyy-MM-dd HH:mm:ss') === wallTime;
  });
}

function timeLabel(date: Date, timezone: string, withOffset: boolean): string {
  const time = formatInTimeZone(date, timezone, 'h:mm a');
  return withOffset ? `${time} (UTC${formatInTimeZone(date, timezone, 'xxx')})` : time;
}

export function formatTime(date: Date, timezone?: string): string {
  const zone = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  return timeLabel(date, zone, isRepeatedLocalTime(date, zone));
}

/** Stable civil-date key in the observation location. */
export function formatDateKey(date: Date, timezone?: string): string {
  return timezone ? formatInTimeZone(date, timezone, 'yyyy-MM-dd') : format(date, 'yyyy-MM-dd');
}

/**
 * Format time range with en-dash separator (e.g., "10:30 PM – 2:45 AM")
 */
export function formatTimeRange(start: Date, end: Date, timezone?: string): string {
  const zone = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const withOffset =
    clockChangeMinutes(start, end, zone) !== 0 ||
    isRepeatedLocalTime(start, zone) ||
    isRepeatedLocalTime(end, zone);
  return `${timeLabel(start, zone, withOffset)} – ${timeLabel(end, zone, withOffset)}`;
}

/**
 * Format a minute duration compactly (for example, "2h 15m" or "35m").
 */
export function formatDurationMinutes(durationMinutes: number): string {
  const roundedMinutes = Math.max(0, Math.round(durationMinutes));
  if (roundedMinutes < 1 && durationMinutes > 0) return '<1m';

  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
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
export function formatDateRange(start: Date, end: Date, timezone?: string): string {
  if (timezone) {
    const startStr = formatInTimeZone(start, timezone, 'MMM d');
    const endStr = formatInTimeZone(end, timezone, 'MMM d, yyyy');
    return `${startStr} - ${endStr}`;
  }
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
export function getNightLabel(date: Date, possessive = false, timezone?: string): string {
  const today = new Date();
  const dateStr = formatDateKey(date, timezone);
  const todayStr = formatDateKey(today, timezone);
  const tomorrow = new Date(`${todayStr}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  // Always include short date for clarity (e.g., "Mon 15")
  const shortDate = timezone ? formatInTimeZone(date, timezone, 'EEE d') : format(date, 'EEE d');

  let label: string;
  if (dateStr === todayStr) {
    label = `Tonight (${shortDate})`;
  } else if (dateStr === tomorrowStr) {
    label = `Tomorrow (${shortDate})`;
  } else {
    // For other days, show day name with date
    label = timezone
      ? formatInTimeZone(date, timezone, 'EEEE (EEE d)')
      : format(date, 'EEEE (EEE d)'); // "Wednesday (Wed 17)"
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
  const p = ((phase % 1) + 1) % 1;
  // Named quarter/full/new phases apply only at the event, not a wide rounded bin.
  const phaseIndex = Number.isInteger(p * 4) ? p * 8 : Math.floor(p * 4) * 2 + 1;
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

  // DSO subtypes — specific matches before generic includes() checks
  if (subtype === 'galaxy' || subtype?.includes('galaxy')) return '🌀';
  if (subtype === 'planetary_nebula') return '💫';
  if (subtype === 'supernova_remnant') return '💥';
  if (subtype === 'dark_nebula') return '🌑';
  if (subtype?.includes('nebula') || subtype === 'hii_region') return '☁️';
  if (subtype?.includes('cluster')) return '✨';

  return '🌌';
}

/**
 * Convert azimuth degrees to 8-point cardinal direction
 */
export function azimuthToCardinal(azimuth: number): string {
  const normalized = ((azimuth % 360) + 360) % 360;
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(normalized / 45) % 8;
  return directions[index];
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
 * Format a date relative to now (e.g., "Tonight", "Tomorrow", "In 3 days")
 */
export function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffDays = Math.round((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Tonight';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return `In ${diffDays} days`;
  if (diffDays < 30) return `In ${Math.round(diffDays / 7)} weeks`;
  if (diffDays < 365) return `In ${Math.round(diffDays / 30)} months`;
  return `In ${Math.round(diffDays / 365)} year(s)`;
}

/** Do not round a real, very small target down to zero area. */
export function formatFrameFillPercent(percent: number): string {
  return percent > 0 && percent < 0.1 ? '<0.1%' : `${percent.toFixed(1)}%`;
}
