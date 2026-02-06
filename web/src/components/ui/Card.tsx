import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Base card container with consistent styling
 */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-night-900 rounded-xl border border-night-700 overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

/**
 * Chevron toggle indicator for expandable sections
 */
export function ToggleChevron({
  expanded,
  className = 'w-5 h-5 text-gray-400',
}: {
  expanded: boolean;
  className?: string;
}) {
  return expanded ? <ChevronDown className={className} /> : <ChevronRight className={className} />;
}

/**
 * Count badge for showing item counts
 */
export function CountBadge({ count }: { count: number }) {
  return (
    <span className="text-sm text-gray-400 bg-night-700 px-2 py-0.5 rounded-full">{count}</span>
  );
}
