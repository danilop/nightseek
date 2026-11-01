import { Bell } from 'lucide-react';
import { useState } from 'react';
import SharedSettingsModal, {
  type SettingsModalProps,
} from '@/components/layout/SettingsModal.shared';
import {
  loadNotificationPrefs,
  NOTIFICATION_LABELS,
  type NotificationPreferences,
  type NotificationType,
  saveNotificationPrefs,
} from '../../lib/notifications/types';

export default function SettingsModal(props: SettingsModalProps) {
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(loadNotificationPrefs);
  const toggleNotifications = () => {
    const updated = { ...notifPrefs, enabled: !notifPrefs.enabled };
    setNotifPrefs(updated);
    saveNotificationPrefs(updated);
  };

  const toggleNotificationType = (type: NotificationType) => {
    const updated = {
      ...notifPrefs,
      types: { ...notifPrefs.types, [type]: !notifPrefs.types[type] },
    };
    setNotifPrefs(updated);
    saveNotificationPrefs(updated);
  };

  return (
    <SharedSettingsModal
      {...props}
      platformSection={
        <>
          {/* NATIVE: Notifications Section */}
          <div className="border-night-700 border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium text-gray-300 text-sm">
                <Bell className="h-4 w-4" />
                <span>Notifications</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={notifPrefs.enabled}
                aria-label="Enable notifications"
                onClick={toggleNotifications}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notifPrefs.enabled ? 'bg-sky-600' : 'bg-night-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notifPrefs.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <p className="mt-2 text-gray-500 text-xs">
              Get alerts for clear skies, meteor showers, and events
            </p>

            {notifPrefs.enabled && (
              <div className="mt-3 space-y-2">
                {(Object.keys(NOTIFICATION_LABELS) as NotificationType[]).map(type => (
                  <div
                    key={type}
                    className="flex items-center justify-between rounded-lg bg-night-800 p-3"
                  >
                    <div>
                      <div className="text-gray-300 text-sm">{NOTIFICATION_LABELS[type].title}</div>
                      <div className="text-gray-500 text-xs">
                        {NOTIFICATION_LABELS[type].description}
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={notifPrefs.types[type]}
                      aria-label={`Toggle ${NOTIFICATION_LABELS[type].title}`}
                      onClick={() => toggleNotificationType(type)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
                        notifPrefs.types[type] ? 'bg-sky-600' : 'bg-night-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          notifPrefs.types[type] ? 'translate-x-4' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      }
    />
  );
}
