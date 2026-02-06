import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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

interface TooltipPosition {
  top: number;
  left: number;
  placement: 'top' | 'bottom';
}

/**
 * Tooltip component that works on both desktop (hover) and mobile (tap).
 * Uses a portal to render at body level, avoiding overflow clipping issues.
 * Renders invisibly first to measure, then shows in correct position.
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
  const [isPositioned, setIsPositioned] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Calculate position based on trigger element's viewport coordinates
  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipHeight = tooltipRef.current.offsetHeight;
    const tooltipWidth = tooltipRef.current.offsetWidth;

    const spaceAbove = triggerRect.top;
    const spaceBelow = window.innerHeight - triggerRect.bottom;

    // Determine vertical placement
    let placement: 'top' | 'bottom' = position;
    if (position === 'top' && spaceAbove < tooltipHeight + 8) {
      placement = 'bottom';
    } else if (position === 'bottom' && spaceBelow < tooltipHeight + 8) {
      placement = 'top';
    }

    // Calculate top position
    let top: number;
    if (placement === 'top') {
      top = triggerRect.top - tooltipHeight - 8;
    } else {
      top = triggerRect.bottom + 8;
    }

    // Calculate left position (centered on trigger, but clamped to viewport)
    let left = triggerRect.left + triggerRect.width / 2 - tooltipWidth / 2;
    const padding = 8;
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));

    setTooltipPosition({ top, left, placement });
    setIsPositioned(true);
  }, [position]);

  const show = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsPositioned(false);
    setIsVisible(true);
  }, []);

  const hide = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
      setIsPositioned(false);
      setTooltipPosition(null);
    }, 100);
  }, []);

  const toggle = useCallback(() => {
    if (isVisible) {
      setIsVisible(false);
      setIsPositioned(false);
      setTooltipPosition(null);
    } else {
      show();
    }
  }, [isVisible, show]);

  // Measure and position after tooltip renders (before paint)
  useLayoutEffect(() => {
    if (isVisible && !isPositioned && tooltipRef.current) {
      updatePosition();
    }
  }, [isVisible, isPositioned, updatePosition]);

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
        setIsPositioned(false);
        setTooltipPosition(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isVisible]);

  // Update position on scroll/resize
  useEffect(() => {
    if (!isVisible || !isPositioned) return;

    const handleUpdate = () => updatePosition();
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [isVisible, isPositioned, updatePosition]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Calculate arrow position relative to trigger
  const getArrowLeft = () => {
    if (!triggerRef.current || !tooltipPosition) return '50%';
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const arrowLeft = triggerRect.left + triggerRect.width / 2 - tooltipPosition.left;
    return `${arrowLeft}px`;
  };

  return (
    <>
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
      </span>
      {isVisible &&
        createPortal(
          <div
            ref={tooltipRef}
            id="tooltip"
            role="tooltip"
            className="fixed z-[9999] pointer-events-none transition-opacity duration-150"
            style={{
              top: tooltipPosition?.top ?? 0,
              left: tooltipPosition?.left ?? 0,
              maxWidth,
              opacity: isPositioned ? 1 : 0,
              visibility: isPositioned ? 'visible' : 'hidden',
            }}
          >
            <div className="bg-night-700 text-gray-200 text-xs px-3 py-2 rounded-lg shadow-lg border border-night-600 pointer-events-auto">
              {content}
            </div>
            {isPositioned && tooltipPosition && (
              <span
                className={`absolute w-0 h-0 border-4 ${
                  tooltipPosition.placement === 'top'
                    ? 'top-full border-t-night-700 border-x-transparent border-b-transparent'
                    : 'bottom-full border-b-night-700 border-x-transparent border-t-transparent'
                }`}
                style={{
                  left: getArrowLeft(),
                  transform: 'translateX(-50%)',
                }}
              />
            )}
          </div>,
          document.body
        )}
    </>
  );
}
