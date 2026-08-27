import { GripVertical } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';
import { Card, ToggleChevron } from './Card';

interface SectionCardProps {
  /** Emoji (rendered at a consistent size) or an icon node. */
  icon: ReactNode;
  title: string;
  titleId?: string;
  /** Count or status pill shown next to the title. */
  badge?: ReactNode;
  /** Collapsed-only summary; hidden on small screens. */
  preview?: ReactNode;
  /** Always-visible status shown left of the chevron. */
  headerAside?: ReactNode;
  /** Always-visible block rendered under the header. */
  subheader?: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  dragHandleProps?: HTMLAttributes<HTMLButtonElement>;
  isDragging?: boolean;
  className?: string;
  /** Padding/spacing for the collapsible body. Pass '' to lay it out manually. */
  bodyClassName?: string;
  children: ReactNode;
}

/**
 * Collapsible section card shared by every top-level section (target categories,
 * Milky Way, Jupiter's moons, event cards): drag handle, header with icon/title/
 * badge/preview, and a collapsible body.
 */
export default function SectionCard({
  icon,
  title,
  titleId,
  badge,
  preview,
  headerAside,
  subheader,
  expanded,
  onToggle,
  dragHandleProps,
  isDragging = false,
  className = '',
  bodyClassName = 'p-4',
  children,
}: SectionCardProps) {
  return (
    <Card
      className={`transition-shadow ${
        isDragging ? 'shadow-lg shadow-sky-500/20 ring-2 ring-sky-500/50' : ''
      } ${className}`}
    >
      <div className="flex items-center">
        {dragHandleProps && (
          <button
            type="button"
            aria-label={`Reorder ${title}`}
            className="cursor-grab touch-none px-2 py-3 text-gray-500 hover:text-gray-300 active:cursor-grabbing"
            {...dragHandleProps}
          >
            <GripVertical className="h-5 w-5" />
          </button>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className={`flex min-w-0 flex-1 items-center justify-between ${
            dragHandleProps ? 'pl-0' : 'pl-4'
          } py-3 pr-4 transition-colors hover:bg-night-800`}
        >
          <div className="flex shrink-0 items-center gap-3">
            {typeof icon === 'string' ? <span className="text-2xl">{icon}</span> : icon}
            <h3 id={titleId} className="whitespace-nowrap font-semibold text-white">
              {title}
            </h3>
            {badge}
          </div>
          <div className="flex min-w-0 items-center gap-2 pl-2">
            {!expanded && preview ? (
              <span className="hidden truncate text-gray-500 text-sm sm:block">{preview}</span>
            ) : null}
            {headerAside}
            <ToggleChevron expanded={expanded} className="h-5 w-5 shrink-0 text-gray-400" />
          </div>
        </button>
      </div>

      {subheader}

      {expanded && (
        <div className={`border-night-700 border-t ${bodyClassName}`.trimEnd()}>{children}</div>
      )}
    </Card>
  );
}
