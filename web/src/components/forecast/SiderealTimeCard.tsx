import { Compass } from 'lucide-react';
import type { NightInfo } from '@/types';

/** Both views display the same precomputed time and midpoint definition. */
export default function SiderealTimeCard({ nightInfo }: { nightInfo: NightInfo }) {
  if (!nightInfo.localSiderealTimeAtMidnight) return null;
  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-sky-400/15 bg-sky-400/5 p-3"
      data-testid="sidereal-time"
    >
      <Compass aria-hidden="true" className="h-6 w-6 shrink-0 text-sky-300" />
      <dl className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
        <dt className="text-gray-200 text-sm">
          Local sidereal time
          <span className="mt-1 block text-gray-400 text-xs">At observing-window midpoint</span>
        </dt>
        <dd className="rounded-lg bg-night-800 px-3 py-2 font-mono text-lg text-sky-200 tabular-nums">
          {nightInfo.localSiderealTimeAtMidnight}
        </dd>
      </dl>
    </div>
  );
}
