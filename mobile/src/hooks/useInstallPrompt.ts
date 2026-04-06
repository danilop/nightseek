/**
 * No-op override for native app — hides the PWA install prompt.
 * The web version listens for `beforeinstallprompt`; in the native app
 * there is nothing to install, so this returns inert values.
 */
export function useInstallPrompt() {
  return {
    canInstall: false,
    isIOS: false,
    triggerInstall: async () => {},
    dismiss: () => {},
  };
}
