import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createMockNightInfo } from '@/test/factories';
import type { Location } from '@/types';
import SkyChart from './SkyChart';

const location: Location = {
  latitude: 51.5074,
  longitude: -0.1278,
  timezone: 'Europe/London',
};

describe('SkyChart', () => {
  it('makes the Milky Way visibility action and current state explicit', () => {
    render(<SkyChart nightInfo={createMockNightInfo()} location={location} />);

    fireEvent.click(screen.getByRole('button', { name: /Sky Chart/i }));

    const hideButton = screen.getByRole('button', { name: 'Hide Milky Way' });
    expect(hideButton).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(hideButton);

    const showButton = screen.getByRole('button', { name: 'Show Milky Way' });
    expect(showButton).toHaveAttribute('aria-pressed', 'false');
  });
});
