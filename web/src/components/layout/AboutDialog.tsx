import { Coffee, Heart, X } from 'lucide-react';
import { useEffect } from 'react';
import NightSeekIcon from '@/components/ui/NightSeekIcon';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { version as APP_VERSION } from '../../../package.json';
import AboutCredits from './AboutCredits';

interface AboutDialogProps {
  onClose: () => void;
}

export default function AboutDialog({ onClose }: AboutDialogProps) {
  useBodyScrollLock();
  const focusTrapRef = useFocusTrap<HTMLDivElement>();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: ESC handled via global keydown listener
    <div
      ref={focusTrapRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/50 p-4 backdrop-blur-sm"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-night-700 bg-night-900 shadow-xl">
        {/* Close button */}
        <div className="flex shrink-0 justify-end p-3 pb-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 transition-colors hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pb-5 text-center sm:px-6">
          <NightSeekIcon className="mx-auto mb-3 h-12 w-12" />
          <h2 id="about-dialog-title" className="font-bold text-2xl text-white">
            About &amp; credits
          </h2>
          <span className="mt-1 text-gray-500 text-sm">NightSeek · v{APP_VERSION}</span>

          <p className="mt-4 text-gray-400">Plan your perfect night of astrophotography</p>

          <div className="mt-6">
            <AboutCredits />
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

          <p className="mt-4 flex items-center justify-center gap-1 text-gray-500 text-sm">
            Built with <Heart className="h-3.5 w-3.5 fill-red-500 text-red-500" /> by Danilo Poccia
          </p>

          <button
            type="button"
            onClick={onClose}
            className="mt-5 min-h-11 w-full rounded-lg bg-sky-600 py-2 font-medium text-white transition-colors hover:bg-sky-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
