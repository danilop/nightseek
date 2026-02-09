import { Coffee, X } from 'lucide-react';
import { useEffect } from 'react';
import NightSeekIcon from '@/components/ui/NightSeekIcon';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { version as APP_VERSION } from '../../../package.json';

interface AboutDialogProps {
  onClose: () => void;
}

export default function AboutDialog({ onClose }: AboutDialogProps) {
  useBodyScrollLock();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss pattern
    // biome-ignore lint/a11y/useKeyWithClickEvents: ESC handled via global keydown listener
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/50 p-4 backdrop-blur-sm"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-xl border border-night-700 bg-night-900 shadow-xl">
        {/* Close button */}
        <div className="flex justify-end p-3 pb-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col items-center px-6 pb-6 text-center">
          <NightSeekIcon className="mb-3 h-16 w-16" />
          <h2 className="font-bold text-2xl text-white">NightSeek</h2>
          <span className="mt-1 text-gray-500 text-sm">v{APP_VERSION}</span>

          <p className="mt-4 text-gray-400">Plan your perfect night of astrophotography</p>

          <div className="mt-3 flex flex-wrap justify-center gap-x-2 gap-y-1 text-gray-500 text-xs">
            <span>Weather</span>
            <span>·</span>
            <span>Visibility</span>
            <span>·</span>
            <span>Timing</span>
            <span>·</span>
            <span>Star Fields</span>
            <span>·</span>
            <span>Mosaic Planning</span>
          </div>

          <a
            href="https://buymeacoffee.com/danilop"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-5 py-2.5 font-medium text-amber-400 text-sm transition-colors hover:bg-amber-500/25"
          >
            <Coffee className="h-4 w-4" />
            Buy Me a Coffee
          </a>

          <p className="mt-5 text-gray-500 text-sm">Built by Danilo Poccia</p>

          <button
            type="button"
            onClick={onClose}
            className="mt-5 w-full rounded-lg bg-sky-600 py-2 font-medium text-white transition-colors hover:bg-sky-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
