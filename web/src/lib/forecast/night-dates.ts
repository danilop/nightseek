import { fromZonedTime } from 'date-fns-tz';
import type { SkyCalculator } from '../astronomy/calculator';
import { formatDateKey } from '../utils/format';

/** Calendar arithmetic belongs to the observing site, regardless of device DST. */
export function nightDateAtOffset(date: Date, timezone: string, offset: number): Date {
  const civil = new Date(`${formatDateKey(date, timezone)}T12:00:00Z`);
  civil.setUTCDate(civil.getUTCDate() + offset);
  return fromZonedTime(`${civil.toISOString().slice(0, 10)}T12:00:00`, timezone);
}

export function firstNightDate(now: Date, timezone: string, calculator: SkyCalculator): Date {
  const previous = nightDateAtOffset(now, timezone, -1);
  const previousNight = calculator.getNightInfo(previous);
  if (previousNight.sunriseOccurs && now >= previousNight.sunset && now < previousNight.sunrise)
    return previous;
  return nightDateAtOffset(now, timezone, 0);
}
