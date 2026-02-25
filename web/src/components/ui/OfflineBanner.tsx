import { WifiOff } from 'lucide-react';

export default function OfflineBanner() {
  return (
    <div className="border-amber-500/30 border-b bg-amber-500/10">
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-center gap-2 text-amber-400 text-sm">
          <WifiOff className="h-4 w-4" />
          <span>You're offline. Some features may be limited.</span>
        </div>
      </div>
    </div>
  );
}
