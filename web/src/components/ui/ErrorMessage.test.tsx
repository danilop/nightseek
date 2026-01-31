import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ErrorMessage from './ErrorMessage';

describe('ErrorMessage', () => {
  it('should render error message text', () => {
    render(<ErrorMessage message="Network error occurred" />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Network error occurred')).toBeInTheDocument();
  });

  it('should not render retry button when onRetry is not provided', () => {
    render(<ErrorMessage message="Test error" />);

    expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
  });

  it('should render retry button when onRetry is provided', () => {
    const handleRetry = vi.fn();
    render(<ErrorMessage message="Test error" onRetry={handleRetry} />);

    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('should call onRetry when retry button is clicked', () => {
    const handleRetry = vi.fn();
    render(<ErrorMessage message="Test error" onRetry={handleRetry} />);

    const retryButton = screen.getByText('Try Again');
    fireEvent.click(retryButton);

    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it('should have proper error styling', () => {
    const { container } = render(<ErrorMessage message="Test error" />);

    const errorDiv = container.firstChild;
    expect(errorDiv).toHaveClass('bg-red-500/10');
  });

  it('should display different messages', () => {
    const { rerender } = render(<ErrorMessage message="First error" />);
    expect(screen.getByText('First error')).toBeInTheDocument();

    rerender(<ErrorMessage message="Second error" />);
    expect(screen.getByText('Second error')).toBeInTheDocument();
    expect(screen.queryByText('First error')).not.toBeInTheDocument();
  });
});
