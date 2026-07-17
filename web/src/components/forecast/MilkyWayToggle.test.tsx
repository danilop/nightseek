import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import MilkyWayToggle from './MilkyWayToggle';

function ToggleHarness() {
  const [visible, setVisible] = useState(true);
  return <MilkyWayToggle visible={visible} onToggle={() => setVisible(value => !value)} />;
}

describe('MilkyWayToggle', () => {
  it('makes the visibility action and current state explicit', () => {
    render(<ToggleHarness />);

    const hideButton = screen.getByRole('button', { name: 'Hide Milky Way' });
    expect(hideButton).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(hideButton);

    const showButton = screen.getByRole('button', { name: 'Show Milky Way' });
    expect(showButton).toHaveAttribute('aria-pressed', 'false');
  });
});
