import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import SkyLayerToggle from './SkyLayerToggle';

function ToggleHarness() {
  const [active, setActive] = useState(true);
  return (
    <SkyLayerToggle label="Milky Way" active={active} onToggle={() => setActive(value => !value)} />
  );
}

describe('SkyLayerToggle', () => {
  it('keeps a stable label while exposing its state and action', () => {
    render(<ToggleHarness />);

    const button = screen.getByRole('button', { name: 'Milky Way' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveAttribute('title', 'Hide Milky Way on the sky chart');

    fireEvent.click(button);

    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveAttribute('title', 'Show Milky Way on the sky chart');
  });
});
