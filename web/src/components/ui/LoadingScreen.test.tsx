import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LoadingScreen from './LoadingScreen';

describe('LoadingScreen', () => {
  it('should render loading message', () => {
    render(<LoadingScreen message="Loading forecast..." percent={50} />);

    expect(screen.getByText('Loading forecast...')).toBeInTheDocument();
  });

  it('should display percentage', () => {
    render(<LoadingScreen message="Loading..." percent={75} />);

    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('should display 0% progress', () => {
    render(<LoadingScreen message="Starting..." percent={0} />);

    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('should display 100% progress', () => {
    render(<LoadingScreen message="Almost done..." percent={100} />);

    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('should have full screen overlay', () => {
    const { container } = render(<LoadingScreen message="Loading..." percent={50} />);

    const overlay = container.firstChild;
    expect(overlay).toHaveClass('fixed', 'inset-0', 'z-40');
  });

  it('should update progress bar width based on percent', () => {
    const { container, rerender } = render(<LoadingScreen message="Loading..." percent={25} />);

    // Find the progress bar by its style
    const progressBar = container.querySelector('[style*="width: 25%"]');
    expect(progressBar).toBeInTheDocument();

    // Update percentage
    rerender(<LoadingScreen message="Loading..." percent={75} />);
    const updatedProgressBar = container.querySelector('[style*="width: 75%"]');
    expect(updatedProgressBar).toBeInTheDocument();
  });

  it('should display different messages', () => {
    const { rerender } = render(<LoadingScreen message="Initializing..." percent={10} />);
    expect(screen.getByText('Initializing...')).toBeInTheDocument();

    rerender(<LoadingScreen message="Calculating visibility..." percent={50} />);
    expect(screen.getByText('Calculating visibility...')).toBeInTheDocument();
  });
});
