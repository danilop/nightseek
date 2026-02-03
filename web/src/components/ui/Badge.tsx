import type { ReactNode } from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-night-700 text-gray-400',
  success: 'bg-green-500/20 text-green-400',
  warning: 'bg-amber-500/20 text-amber-400',
  danger: 'bg-red-500/20 text-red-400',
  info: 'bg-sky-500/20 text-sky-400',
  purple: 'bg-purple-500/20 text-purple-400',
};

/**
 * Reusable badge component with consistent styling
 */
export function Badge({
  children,
  variant = 'default',
  className = '',
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  );
}

/**
 * Get the appropriate badge variant based on a numeric value and thresholds
 * Higher values are better when ascending=true (e.g., altitude)
 * Lower values are better when ascending=false (e.g., distance)
 */
export function getStatusVariant(
  value: number,
  thresholds: { danger?: number; warning?: number; success?: number },
  ascending = true
): BadgeVariant {
  return ascending
    ? getAscendingVariant(value, thresholds)
    : getDescendingVariant(value, thresholds);
}

function getAscendingVariant(
  value: number,
  { danger, warning, success }: { danger?: number; warning?: number; success?: number }
): BadgeVariant {
  if (success !== undefined && value >= success) return 'success';
  if (warning !== undefined && value >= warning) return 'warning';
  if (danger !== undefined && value < danger) return 'danger';
  return 'warning';
}

function getDescendingVariant(
  value: number,
  { danger, warning, success }: { danger?: number; warning?: number; success?: number }
): BadgeVariant {
  if (success !== undefined && value <= success) return 'success';
  if (warning !== undefined && value <= warning) return 'warning';
  if (danger !== undefined && value > danger) return 'danger';
  return 'warning';
}
