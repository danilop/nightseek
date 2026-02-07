import { useEffect } from 'react';

/**
 * Locks body scroll while the component is mounted.
 * On mobile (< 640px), optionally scrolls to top and restores position on unmount.
 */
export function useBodyScrollLock({ scrollToTopOnMobile = false } = {}) {
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalScrollY = window.scrollY;

    if (scrollToTopOnMobile && window.innerWidth < 640) {
      window.scrollTo({ top: 0 });
    }

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
      if (scrollToTopOnMobile && window.innerWidth < 640) {
        window.scrollTo({ top: originalScrollY });
      }
    };
  }, [scrollToTopOnMobile]);
}
