import { LocalNotifications } from '@capacitor/local-notifications';
import { fromZonedTime } from 'date-fns-tz';
import { planNightNotification } from '@/lib/planning/night-notification';
import { getCached } from '@/lib/utils/cache';
import { formatDateKey } from '@/lib/utils/format';
import {
  createDefaultHorizonProfile,
  getHorizonProfileCacheKey,
  normalizeHorizonProfile,
} from '@/lib/utils/horizon-profile';
import type { HorizonProfile, Location, NightForecast, ScoredObject } from '@/types';
import { isNativePlatform } from '../native/platform';
import { loadNotificationPrefs } from './types';

/** Notification ID ranges to avoid collisions */
const ID_RANGES = {
  optimal_night: 1000,
  meteor_shower: 2000,
  aurora_alert: 3000,
  iss_pass: 4000,
  event_reminder: 5000,
} as const;

/** Request notification permissions (deferred — called on first forecast, not on launch) */
export async function requestPermission(): Promise<boolean> {
  if (!isNativePlatform()) return false;

  try {
    let permStatus = await LocalNotifications.checkPermissions();
    if (permStatus.display === 'prompt') {
      permStatus = await LocalNotifications.requestPermissions();
    }
    return permStatus.display === 'granted';
  } catch {
    return false;
  }
}

/** Cancel all previously scheduled NightSeek notifications */
async function cancelAllScheduled(): Promise<void> {
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel(pending);
    }
  } catch {
    // Ignore cancel errors
  }
}

/**
 * Schedule notifications from forecast data.
 * Called after generateForecast() completes in AppContext.
 */
export async function scheduleNotificationsFromForecast(
  forecasts: NightForecast[],
  scoredObjects: Map<string, ScoredObject[]>,
  location: Location
): Promise<void> {
  if (!isNativePlatform()) return;

  const prefs = loadNotificationPrefs();
  if (!prefs.enabled) return;

  const hasPermission = await requestPermission();
  if (!hasPermission) return;

  // Cancel all existing notifications before scheduling new ones
  await cancelAllScheduled();

  const notifications: Array<{
    id: number;
    title: string;
    body: string;
    schedule: { at: Date };
  }> = [];

  const now = new Date();
  const timezone = location.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const profile = normalizeHorizonProfile(
    (await getCached<HorizonProfile>(getHorizonProfileCacheKey(location), Infinity)) ??
      createDefaultHorizonProfile()
  );
  let notifIndex = 0;

  for (const forecast of forecasts) {
    const dateKey = formatDateKey(forecast.nightInfo.date, timezone);
    const nightObjects = scoredObjects.get(dateKey) ?? [];

    if (prefs.types.optimal_night) {
      const plan = planNightNotification(forecast, nightObjects, profile, now);
      if (plan)
        notifications.push({
          id: ID_RANGES.optimal_night + notifIndex++,
          title: plan.title,
          body: plan.body,
          schedule: { at: plan.at },
        });
    }

    // 2. Meteor Shower notifications
    if (prefs.types.meteor_shower && forecast.meteorShowers.length > 0) {
      for (const shower of forecast.meteorShowers) {
        if (shower.daysFromPeak !== null && Math.abs(shower.daysFromPeak) <= 1) {
          // Schedule at 6pm on the peak day
          const notifTime = fromZonedTime(`${dateKey}T18:00:00`, timezone);
          if (notifTime > now) {
            notifications.push({
              id: ID_RANGES.meteor_shower + notifIndex++,
              title: `${shower.name} Peak Tonight`,
              body: `Ideal dark-sky rate: ${shower.zhr} meteors/hour. Actual counts depend on weather, Moon and radiant altitude.`,
              schedule: { at: notifTime },
            });
          }
        }
      }
    }

    // 3. Aurora Alert notifications
    if (prefs.types.aurora_alert && forecast.astronomicalEvents.auroraForecast) {
      const aurora = forecast.astronomicalEvents.auroraForecast;
      if (
        aurora.chance === 'possible' ||
        aurora.chance === 'likely' ||
        aurora.chance === 'certain'
      ) {
        // Schedule at dusk
        const notifTime = new Date(forecast.nightInfo.astronomicalDusk);
        if (notifTime > now) {
          notifications.push({
            id: ID_RANGES.aurora_alert + notifIndex++,
            title: `Aurora ${aurora.chance === 'certain' ? 'Expected' : 'Possible'} Tonight`,
            body: `Kp index: ${aurora.currentMaxKp}. ${aurora.description}`,
            schedule: { at: notifTime },
          });
        }
      }
    }

    // 4. Event Reminder notifications
    if (prefs.types.event_reminder) {
      const events = forecast.astronomicalEvents;

      if (events.lunarEclipse?.isVisible) {
        const notifTime = fromZonedTime(`${dateKey}T12:00:00`, timezone);
        if (notifTime > now) {
          notifications.push({
            id: ID_RANGES.event_reminder + notifIndex++,
            title: `Lunar Eclipse Tonight`,
            body: `${events.lunarEclipse.kind} lunar eclipse visible from your location.`,
            schedule: { at: notifTime },
          });
        }
      }

      for (const opp of events.oppositions) {
        if (opp.isActive && opp.daysUntil <= 1) {
          const notifTime = new Date(forecast.nightInfo.sunset.getTime() - 2 * 60 * 60 * 1000);
          if (notifTime > now) {
            notifications.push({
              id: ID_RANGES.event_reminder + notifIndex++,
              title: `${opp.planet} at Opposition`,
              body: `${opp.planet} is at its brightest — ideal for observation tonight.`,
              schedule: { at: notifTime },
            });
          }
        }
      }

      if (events.solarEclipse && events.solarEclipse.obscuration > 0) {
        const notifTime = new Date(events.solarEclipse.peakTime.getTime() - 2 * 60 * 60 * 1000);
        if (notifTime > now) {
          notifications.push({
            id: ID_RANGES.event_reminder + notifIndex++,
            title: `Solar Eclipse Today`,
            body: `${events.solarEclipse.kind} solar eclipse — ${Math.round(events.solarEclipse.obscuration * 100)}% obscuration.`,
            schedule: { at: notifTime },
          });
        }
      }
    }
  }

  // Schedule all notifications
  if (notifications.length > 0) {
    try {
      await LocalNotifications.schedule({ notifications });
    } catch {
      // Scheduling failed silently
    }
  }
}
