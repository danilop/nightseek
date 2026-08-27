import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { HTMLAttributes, ReactNode } from 'react';

export interface SortableSectionRenderProps {
  dragHandleProps: HTMLAttributes<HTMLButtonElement>;
  isDragging: boolean;
}

/**
 * Drag-and-drop wrapper for a reorderable top-level section. Hands the section
 * its drag handle props so every section is reordered the same way.
 */
export default function SortableSection({
  id,
  children,
}: {
  id: string;
  children: (props: SortableSectionRenderProps) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'relative z-10' : undefined}
    >
      {children({ dragHandleProps: { ...attributes, ...listeners }, isDragging })}
    </div>
  );
}
