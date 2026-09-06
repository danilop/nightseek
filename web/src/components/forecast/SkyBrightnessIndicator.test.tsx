import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useSkyBrightness } from '@/lib/lightpollution/useSkyBrightness';
import SkyBrightnessIndicator from './SkyBrightnessIndicator';

vi.mock('@/lib/lightpollution/useSkyBrightness', () => ({ useSkyBrightness: vi.fn() }));
it('shows a decimal estimate alongside the physical brightness and units', () => {
  vi.mocked(useSkyBrightness).mockReturnValue({
    data: { magnitudes: 18.1, artificialToNaturalRatio: 35.3 },
    loading: false,
  });
  render(<SkyBrightnessIndicator latitude={51.5} longitude={-0.1} />);
  expect(screen.getByText('Bortle 8.5 est.')).toBeInTheDocument();
  expect(screen.getByText('18.1 mag/arcsec²')).toBeInTheDocument();
  expect(screen.getByRole('img')).toHaveAttribute(
    'aria-label',
    expect.stringContaining('does not mean accuracy to 0.1 class')
  );
});
it('does not invent a Bortle estimate for unavailable data', () => {
  vi.mocked(useSkyBrightness).mockReturnValue({ data: null, loading: false });
  render(<SkyBrightnessIndicator latitude={51.5} longitude={-0.1} />);
  expect(screen.getByText('Sky unavailable')).toBeInTheDocument();
  expect(screen.queryByText(/Bortle .* est\./)).not.toBeInTheDocument();
});
