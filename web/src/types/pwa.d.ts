/**
 * The `beforeinstallprompt` event fires on Chromium-based browsers
 * (Chrome, Edge, Samsung Internet, Opera) when the PWA install criteria are met.
 */
interface BeforeInstallPromptEvent extends Event {
  /** Shows the native install dialog. */
  prompt(): Promise<void>;
  /** Resolves after the user responds to the install dialog. */
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export type { BeforeInstallPromptEvent };
