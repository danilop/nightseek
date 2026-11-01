import { ChevronDown } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';

/** One disclosure pattern: keyboard/touch friendly, with optional lazy content. */
export default function ExplainSection({
  title,
  summary,
  children,
  defaultOpen = false,
  onOpenChange,
  className = '',
}: {
  title: string;
  summary?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className={`rounded-xl border border-night-700 bg-night-900 ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setOpen(!open);
          onOpenChange?.(!open);
        }}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-sky-400"
      >
        <span className="min-w-0">
          <span className="block font-medium text-gray-200 text-sm">{title}</span>
          {summary && <span className="mt-1 block text-gray-400 text-xs">{summary}</span>}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-sky-300 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div id={id} hidden={!open}>
        {open && (
          <div className="space-y-3 border-night-700 border-t p-4 text-gray-300 text-sm">
            {children}
          </div>
        )}
      </div>
    </section>
  );
}
