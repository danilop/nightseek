import { WifiOff } from 'lucide-react';

export default function OfflineBanner() {
  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30">
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-center gap-2 text-sm text-amber-400">
          <WifiOff className="w-4 h-4" />
          <span>You're offline. Some features may be limited.</span>
        </div>
      </div>
    </div>
  );
}
