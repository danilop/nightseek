import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import OfflineBanner from './OfflineBanner';

describe('OfflineBanner', () => {
  it('should render offline message', () => {
    render(<OfflineBanner />);

    expect(screen.getByText("You're offline. Some features may be limited.")).toBeInTheDocument();
  });

  it('should have warning styling', () => {
    const { container } = render(<OfflineBanner />);

    const banner = container.firstChild;
    expect(banner).toHaveClass('bg-amber-500/10');
  });

  it('should render consistently', () => {
    const { container: container1 } = render(<OfflineBanner />);
    const { container: container2 } = render(<OfflineBanner />);

    expect(container1.innerHTML).toBe(container2.innerHTML);
  });
});
