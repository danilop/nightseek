import { Download, Share } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

interface InstallPromptProps {
  onComplete: () => void;
}

export default function InstallPrompt({ onComplete }: InstallPromptProps) {
  const { canInstall, isIOS, triggerInstall, dismiss } = useInstallPrompt();

  if (!canInstall) {
    return null;
  }

  const handleDismiss = () => {
    dismiss();
    onComplete();
  };

  if (isIOS) {
    return (
      <div className="container mx-auto max-w-md px-4 py-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-sky-500/20">
            <Download className="h-8 w-8 text-sky-400" />
          </div>
          <h2 className="mb-2 font-bold text-2xl text-white">Install NightSeek</h2>
          <p className="text-gray-400">Add to your home screen for quick access</p>
        </div>

        <div className="mb-8 rounded-xl bg-night-800 p-5">
          <p className="mb-3 text-gray-300 text-sm">To install on your device:</p>
          <ol className="space-y-3 text-gray-400 text-sm">
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-night-700 font-medium text-white text-xs">
                1
              </span>
              <span>
                Tap the <Share className="inline h-4 w-4 text-sky-400" /> Share button in Safari
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-night-700 font-medium text-white text-xs">
                2
              </span>
              <span>Scroll down and tap "Add to Home Screen"</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-night-700 font-medium text-white text-xs">
                3
              </span>
              <span>Tap "Add" to confirm</span>
            </li>
          </ol>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="w-full rounded-xl bg-night-800 px-6 py-3 font-medium text-gray-300 transition-colors hover:bg-night-700"
        >
          Not now
        </button>
      </div>
    );
  }

  // Chromium browsers
  return (
    <div className="container mx-auto max-w-md px-4 py-8">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-sky-500/20">
          <Download className="h-8 w-8 text-sky-400" />
        </div>
        <h2 className="mb-2 font-bold text-2xl text-white">Install NightSeek</h2>
        <p className="text-gray-400">Get quick access from your home screen</p>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={async () => {
            await triggerInstall();
            onComplete();
          }}
          className="w-full rounded-xl bg-sky-600 px-6 py-3 font-medium text-white transition-colors hover:bg-sky-500"
        >
          Install App
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="w-full rounded-xl bg-night-800 px-6 py-3 font-medium text-gray-300 transition-colors hover:bg-night-700"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
