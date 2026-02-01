import { useCallback, useEffect, useRef, useState } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  /** Show dotted underline to indicate help is available */
  showIndicator?: boolean;
  /** Position preference (auto-adjusts if not enough space) */
  position?: 'top' | 'bottom';
  /** Max width of tooltip */
  maxWidth?: number;
}

/**
 * Tooltip component that works on both desktop (hover) and mobile (tap).
 * Tap anywhere outside to dismiss on mobile.
 */
export default function Tooltip({
  content,
  children,
  showIndicator = false,
  position = 'top',
  maxWidth = 250,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Calculate position to avoid going off-screen
  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipHeight = tooltipRef.current.offsetHeight;
    const spaceAbove = triggerRect.top;
    const spaceBelow = window.innerHeight - triggerRect.bottom;

    if (position === 'top' && spaceAbove < tooltipHeight + 8) {
      setActualPosition('bottom');
    } else if (position === 'bottom' && spaceBelow < tooltipHeight + 8) {
      setActualPosition('top');
    } else {
      setActualPosition(position);
    }
  }, [position]);

  const show = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(true);
    // Update position after render
    requestAnimationFrame(updatePosition);
  }, [updatePosition]);

  const hide = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsVisible(false), 100);
  }, []);

  const toggle = useCallback(() => {
    if (isVisible) {
      setIsVisible(false);
    } else {
      show();
    }
  }, [isVisible, show]);

  // Handle click outside to dismiss (mobile)
  useEffect(() => {
    if (!isVisible) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node)
      ) {
        setIsVisible(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isVisible]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const positionClasses =
    actualPosition === 'top'
      ? 'bottom-full left-1/2 -translate-x-1/2 mb-2'
      : 'top-full left-1/2 -translate-x-1/2 mt-2';

  const arrowClasses =
    actualPosition === 'top'
      ? 'top-full left-1/2 -translate-x-1/2 border-t-night-700 border-x-transparent border-b-transparent'
      : 'bottom-full left-1/2 -translate-x-1/2 border-b-night-700 border-x-transparent border-t-transparent';

  return (
    <span className="relative inline-flex" ref={triggerRef}>
      <span
        className={`cursor-help ${showIndicator ? 'border-b border-dotted border-gray-500' : ''}`}
        onMouseEnter={show}
        onMouseLeave={hide}
        onClick={toggle}
        onKeyDown={e => e.key === 'Enter' && toggle()}
        role="button"
        tabIndex={0}
        aria-describedby={isVisible ? 'tooltip' : undefined}
      >
        {children}
      </span>
      {isVisible && (
        <div
          ref={tooltipRef}
          id="tooltip"
          role="tooltip"
          className={`absolute z-50 ${positionClasses}`}
          style={{ maxWidth }}
        >
          <div className="bg-night-700 text-gray-200 text-xs px-3 py-2 rounded-lg shadow-lg border border-night-600">
            {content}
          </div>
          <span className={`absolute w-0 h-0 border-4 ${arrowClasses}`} />
        </div>
      )}
    </span>
  );
}

/**
 * InfoIcon component for fields that need explanation.
 * Wrap with Tooltip for the help text.
 */
export function InfoIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`inline-block w-3.5 h-3.5 text-gray-500 ${className}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      role="img"
      aria-label="Info"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}
