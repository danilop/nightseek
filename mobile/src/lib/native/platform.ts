import { Capacitor } from '@capacitor/core';

/** Check if running as a native app (iOS/macOS) vs web browser */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/** Get the native platform name */
export function getPlatform(): 'ios' | 'android' | 'web' {
  return Capacitor.getPlatform() as 'ios' | 'android' | 'web';
}
