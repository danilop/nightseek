import { X } from 'lucide-react';
import { useMagnitudeFilter } from '@/hooks/useMagnitudeFilter';
import { formatMagnitude } from '@/lib/utils/format';

export default function MagnitudeFilterStatus() {
  const { limit, setLimit } = useMagnitudeFilter();
  if (limit === null) return null;
  return (
    <button
      type="button"
      onClick={() => setLimit(null)}
      aria-label="Clear magnitude filter"
      className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-sky-400/10 px-3 text-sky-200 text-xs"
    >
      mag ≤ {formatMagnitude(limit)} · known only <X aria-hidden="true" className="h-3 w-3" />
    </button>
  );
}
