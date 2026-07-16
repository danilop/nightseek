import { describe, expect, it } from 'vitest';
import { getEffectiveFOV } from './presets';

describe('getEffectiveFOV', () => {
  it('does not invent an optical field of view for Just exploring', () => {
    expect(getEffectiveFOV('generic', null)).toBeNull();
  });

  it('returns the configured telescope field of view', () => {
    expect(getEffectiveFOV('dwarf_mini', null)).toEqual({ width: 128, height: 72 });
  });
});
