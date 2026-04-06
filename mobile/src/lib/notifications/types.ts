export type NotificationType =
  | 'optimal_night'
  | 'meteor_shower'
  | 'aurora_alert'
  | 'iss_pass'
  | 'event_reminder';

export interface NotificationPreferences {
  enabled: boolean;
  types: Record<NotificationType, boolean>;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  enabled: true,
  types: {
    optimal_night: true,
    meteor_shower: true,
    aurora_alert: true,
    iss_pass: true,
    event_reminder: true,
  },
};

export const NOTIFICATION_LABELS: Record<NotificationType, { title: string; description: string }> =
  {
    optimal_night: {
      title: 'Optimal Nights',
      description: 'Clear skies with good seeing conditions',
    },
    meteor_shower: {
      title: 'Meteor Showers',
      description: 'Peak meteor shower activity',
    },
    aurora_alert: {
      title: 'Aurora Alerts',
      description: 'Geomagnetic activity favorable for your latitude',
    },
    iss_pass: {
      title: 'ISS Passes',
      description: 'Bright ISS passes (magnitude < -2)',
    },
    event_reminder: {
      title: 'Event Reminders',
      description: 'Eclipses, oppositions, and conjunctions',
    },
  };

export const NOTIFICATION_PREFS_KEY = 'nightseek:notification-prefs';

export function loadNotificationPrefs(): NotificationPreferences {
  try {
    const saved = localStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_NOTIFICATION_PREFS, ...parsed };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_NOTIFICATION_PREFS;
}

export function saveNotificationPrefs(prefs: NotificationPreferences): void {
  localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
}
