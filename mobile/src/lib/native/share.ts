import { Share } from '@capacitor/share';
import { isNativePlatform } from './platform';

/** Share observation plan text via native share sheet */
export async function shareObservationPlan(title: string, text: string): Promise<void> {
  if (!isNativePlatform()) return;

  await Share.share({
    title,
    text,
    dialogTitle: 'Share Observation Plan',
  });
}

/** Share with a URL */
export async function shareLink(title: string, text: string, url: string): Promise<void> {
  if (!isNativePlatform()) return;

  await Share.share({
    title,
    text,
    url,
    dialogTitle: 'Share via NightSeek',
  });
}

/** Check if native share is available */
export function canShare(): boolean {
  return isNativePlatform();
}
