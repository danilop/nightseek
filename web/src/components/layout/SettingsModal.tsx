import { Download, Share } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import SharedSettingsModal, { type SettingsModalProps } from './SettingsModal.shared';

export default function SettingsModal(props: SettingsModalProps) {
  const { canInstall, isIOS, triggerInstall } = useInstallPrompt();
  return (
    <SharedSettingsModal
      {...props}
      platformSection={
        <>
          {/* Install App Section */}
          {(canInstall || isIOS) && (
            <div className="border-night-700 border-t pt-4">
              <div className="flex items-center gap-2 font-medium text-gray-300 text-sm">
                <Download className="h-4 w-4" />
                <span>Install App</span>
              </div>
              {isIOS ? (
                <p className="mt-2 text-gray-400 text-sm">
                  Tap <Share className="inline h-3.5 w-3.5 text-sky-400" /> Share in Safari, then
                  "Add to Home Screen"
                </p>
              ) : (
                <button
                  type="button"
                  onClick={triggerInstall}
                  className="mt-2 rounded-lg bg-sky-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-sky-500"
                >
                  Install
                </button>
              )}
              <p className="mt-2 text-gray-500 text-xs">
                Install NightSeek for quick access from your home screen
              </p>
            </div>
          )}
        </>
      }
    />
  );
}
