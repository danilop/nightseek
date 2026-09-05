import { describe, expect, it } from 'vitest';
import { createSessionCalendar } from './calendar';

describe('calendar export', () => {
  const input = {
    name: 'M31',
    start: new Date('2026-10-25T00:30Z'),
    end: new Date('2026-10-25T02:30Z'),
    location: 'Site, west; hill',
    description: 'First line\nSecond line',
  };
  it('uses absolute UTC times across the repeated DST hour and escapes text', () => {
    const result = createSessionCalendar(input, input.start);
    expect(result).toContain('DTSTART:20261025T003000Z\r\nDTEND:20261025T023000Z');
    expect(result).toContain('LOCATION:Site\\, west\\; hill');
    expect(result).toContain('DESCRIPTION:First line\\nSecond line');
  });
  it('folds Unicode lines by bytes without losing characters', () => {
    const result = createSessionCalendar({ ...input, description: '🌌'.repeat(80) });
    for (const line of result.split('\r\n'))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(result.replace(/\r\n /g, '')).toContain(`DESCRIPTION:${'🌌'.repeat(80)}`);
  });
  it('rejects empty, reversed and invalid intervals', () => {
    for (const end of [input.start, new Date(0), new Date(NaN)])
      expect(() => createSessionCalendar({ ...input, end })).toThrow(RangeError);
  });
});
