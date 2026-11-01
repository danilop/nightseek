import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Magnitude from './Magnitude';

describe('target magnitude labels', () => {
  it.each([
    [-2.7, 'mag -2.7'],
    [0, 'mag 0.0'],
    [3.44, 'mag 3.4'],
  ])('keeps magnitude %s visible, including bright and zero values', (value, label) => {
    render(<Magnitude value={value} />);
    expect(screen.getByText(label)).toBeVisible();
  });
  it.each([null, undefined, Number.NaN, Number.POSITIVE_INFINITY])(
    'labels unavailable magnitude explicitly (%s)',
    value => {
      render(<Magnitude value={value} />);
      expect(screen.getByText('mag —')).toBeVisible();
      expect(screen.getByText('Magnitude unknown')).toBeInTheDocument();
    }
  );
  it('distinguishes predictions from catalogue values', () => {
    render(<Magnitude value={-1.3} estimated />);
    expect(screen.getByText('est. mag -1.3')).toBeVisible();
  });
});
