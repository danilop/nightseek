import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { createMockNightForecast } from '@/test/factories';
import SiderealTimeCard from './SiderealTimeCard';

it('separates the shared midpoint label and time into a definition and value', () => {
  const nightInfo = {
    ...createMockNightForecast().nightInfo,
    localSiderealTimeAtMidnight: '2h 33m',
  };
  render(<SiderealTimeCard nightInfo={nightInfo} />);
  expect(screen.getByRole('term')).toHaveTextContent('Local sidereal time');
  expect(screen.getByRole('definition')).toHaveTextContent('2h 33m');
  expect(screen.getByText('At observing-window midpoint')).toBeVisible();
});
