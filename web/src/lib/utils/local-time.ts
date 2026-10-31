import { formatInTimeZone } from 'date-fns-tz';

const LOCAL_MINUTE = "yyyy-MM-dd'T'HH:mm";

/** All instants matching a local minute: none in a clock gap, two in a repeated hour. */
export function resolveLocalMinute(value: string, timezone: string): Date[] {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return [];
  const wallTime = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(wallTime)) return [];
  // Observe both sides of nearby offset changes. Deriving offsets from real
  // instants avoids a library silently choosing an occurrence of a civil time.
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const probe = wallTime + hours * 3_600_000;
    const local = formatInTimeZone(new Date(probe), timezone, LOCAL_MINUTE);
    offsets.add(Date.parse(`${local}:00Z`) - probe);
  }
  return [...offsets]
    .map(offset => new Date(wallTime - offset))
    .filter(instant => formatInTimeZone(instant, timezone, LOCAL_MINUTE) === value)
    .sort((a, b) => a.getTime() - b.getTime());
}
