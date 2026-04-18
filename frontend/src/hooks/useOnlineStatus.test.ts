import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useOnlineStatus } from './useOnlineStatus';

describe('useOnlineStatus', () => {
  it('returns true when navigator.onLine is true', () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(navigator.onLine);
  });

  it('updates when offline event fires', () => {
    const { result } = renderHook(() => useOnlineStatus());
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(false);
    // Restore
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(true);
  });
});
