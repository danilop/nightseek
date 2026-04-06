import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNativePlatform } from './platform';

/** Light impact haptic — use on night card selection */
export async function lightImpact(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Haptics not available
  }
}

/** Medium impact haptic — use on significant interactions */
export async function mediumImpact(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    // Haptics not available
  }
}

/** Selection changed haptic — use during drag-and-drop reordering */
export async function selectionChanged(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    await Haptics.selectionChanged();
  } catch {
    // Haptics not available
  }
}

/** Success notification haptic */
export async function notifySuccess(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    // Haptics not available
  }
}
