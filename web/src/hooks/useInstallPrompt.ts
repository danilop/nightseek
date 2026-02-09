import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { BeforeInstallPromptEvent } from '@/types/pwa';

const DISMISSED_KEY = 'nightseek:pwa-dismissed';

// Module-level singleton — captures the event before React mounts
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let cachedSnapshot: { deferredPrompt: BeforeInstallPromptEvent | null; installed: boolean } = {
  deferredPrompt,
  installed,
};

function updateSnapshot() {
  cachedSnapshot = { deferredPrompt, installed };
}

function getSnapshot() {
  return cachedSnapshot;
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: BeforeInstallPromptEvent) => {
    e.preventDefault();
    deferredPrompt = e;
    updateSnapshot();
    notifyListeners();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installed = true;
    updateSnapshot();
    notifyListeners();
  });
}

function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone =
    'standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true;
  return isIOS && !isStandalone;
}

export function useInstallPrompt() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const dismissed =
    typeof localStorage !== 'undefined' && localStorage.getItem(DISMISSED_KEY) === 'true';

  const isIOS = isIOSSafari();
  const canInstall =
    !dismissed && !snapshot.installed && (snapshot.deferredPrompt !== null || isIOS);

  const triggerInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      deferredPrompt = null;
      updateSnapshot();
      notifyListeners();
    }
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    deferredPrompt = null;
    updateSnapshot();
    notifyListeners();
  }, []);

  // Re-notify on mount to pick up any event captured before this hook mounted
  useEffect(() => {
    notifyListeners();
  }, []);

  return { canInstall, isIOS, triggerInstall, dismiss };
}
