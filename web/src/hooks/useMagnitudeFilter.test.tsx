import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMagnitudeFilter } from './useMagnitudeFilter';

beforeEach(() => {
  const values = new Map<string, string>();
  vi.mocked(localStorage.getItem).mockImplementation(key => values.get(key) ?? null);
  vi.mocked(localStorage.setItem).mockImplementation((key, value) => {
    values.set(key, value);
  });
  vi.mocked(localStorage.removeItem).mockImplementation(key => {
    values.delete(key);
  });
});
describe('shared magnitude filter', () => {
  it('synchronizes mounted views, persists and explicitly clears the limit', () => {
    const first = renderHook(useMagnitudeFilter);
    const second = renderHook(useMagnitudeFilter);
    expect(first.result.current.limit).toBeNull();
    act(() => first.result.current.setLimit(6));
    expect(second.result.current.limit).toBe(6);
    expect(localStorage.getItem('nightseek:magLimit')).toBe('6');
    const reopened = renderHook(useMagnitudeFilter);
    expect(reopened.result.current.limit).toBe(6);
    act(() => second.result.current.setLimit(null));
    expect(first.result.current.limit).toBeNull();
    expect(reopened.result.current.limit).toBeNull();
    expect(localStorage.getItem('nightseek:magLimit')).toBeNull();
  });
  it.each(['', 'bad', 'NaN', 'Infinity', '100'])('ignores invalid saved limit %s', saved => {
    localStorage.setItem('nightseek:magLimit', saved);
    expect(renderHook(useMagnitudeFilter).result.current.limit).toBeNull();
  });
  it('accepts zero and synchronizes cross-tab changes', () => {
    localStorage.setItem('nightseek:magLimit', '0');
    const { result } = renderHook(useMagnitudeFilter);
    expect(result.current.limit).toBe(0);
    act(() => {
      localStorage.setItem('nightseek:magLimit', '-2');
      window.dispatchEvent(new StorageEvent('storage', { key: 'nightseek:magLimit' }));
    });
    expect(result.current.limit).toBe(-2);
  });
});
