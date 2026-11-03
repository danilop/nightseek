import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FrameFill from './FrameFill';

vi.mock('@/stores/AppContext', () => ({
  useApp: () => ({
    state: { settings: { telescope: 'custom', customFOV: { width: 100, height: 100 } } },
  }),
}));
describe('shared field-of-view tag', () => {
  it('shows dimensions and fit rather than an ambiguous area percentage', () => {
    const { rerender } = render(
      <FrameFill visibility={{ angularSizeArcmin: 10, minorAxisArcmin: 10 }} category="dso" />
    );
    expect(screen.getByTestId('target-frame-fill')).toHaveTextContent('10′ × 10′ · Fits in frame');
    rerender(
      <FrameFill visibility={{ angularSizeArcmin: 1, minorAxisArcmin: 1 }} category="dso" />
    );
    expect(screen.getByTestId('target-frame-fill')).toHaveTextContent('1′ × 1′ · Small in frame');
  });
  it('distinguishes unknown size from estimated minor axis', () => {
    const { rerender } = render(<FrameFill visibility={{ angularSizeArcmin: 0 }} category="dso" />);
    expect(screen.getByTestId('target-frame-fill')).toHaveTextContent('FoV unknown');
    rerender(<FrameFill visibility={{ angularSizeArcmin: 10 }} category="dso" />);
    expect(screen.getByTestId('target-frame-fill')).toHaveTextContent('10′ · width unknown');
  });
  it('does not misrepresent a planet or comet as an extended deep-sky target', () => {
    const { rerender } = render(
      <FrameFill visibility={{ angularSizeArcmin: 10 }} category="planet" />
    );
    expect(screen.queryByTestId('target-frame-fill')).toBeNull();
    rerender(<FrameFill visibility={{ angularSizeArcmin: 10 }} category="comet" />);
    expect(screen.queryByTestId('target-frame-fill')).toBeNull();
  });
});
