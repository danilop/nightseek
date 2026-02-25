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
    <span className={`rounded px-2 py-0.5 text-xs ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  );
}
