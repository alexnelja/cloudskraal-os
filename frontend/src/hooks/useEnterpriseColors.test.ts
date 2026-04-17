import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ENTERPRISE_COLORS } from '../types/farm';

const LS_KEY = 'capex.enterprise-colors';

let store: Record<string, string> = {};

beforeEach(() => {
  store = {};
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
  });
  // Force-reset the module-level cache by re-importing
  vi.resetModules();
});

async function loadHook() {
  const mod = await import('./useEnterpriseColors');
  return mod.useEnterpriseColors;
}

describe('useEnterpriseColors', () => {
  it('returns default colours when no overrides exist', async () => {
    const useEnterpriseColors = await loadHook();
    const { result } = renderHook(() => useEnterpriseColors());
    expect(result.current.colors.rooibos).toBe(ENTERPRISE_COLORS.rooibos);
    expect(result.current.colors.wine).toBe(ENTERPRISE_COLORS.wine);
  });

  it('setColor overrides a single enterprise and persists to localStorage', async () => {
    const useEnterpriseColors = await loadHook();
    const { result } = renderHook(() => useEnterpriseColors());
    act(() => result.current.setColor('rooibos', '#ff0000'));
    expect(result.current.colors.rooibos).toBe('#ff0000');
    expect(result.current.colors.wine).toBe(ENTERPRISE_COLORS.wine);
    const stored = JSON.parse(store[LS_KEY]!);
    expect(stored.rooibos).toBe('#ff0000');
  });

  it('resetColor reverts to the default', async () => {
    const useEnterpriseColors = await loadHook();
    const { result } = renderHook(() => useEnterpriseColors());
    act(() => result.current.setColor('rooibos', '#ff0000'));
    expect(result.current.colors.rooibos).toBe('#ff0000');
    act(() => result.current.resetColor('rooibos'));
    expect(result.current.colors.rooibos).toBe(ENTERPRISE_COLORS.rooibos);
  });

  it('round-trips overrides through localStorage', async () => {
    const useEnterpriseColors = await loadHook();
    const { result } = renderHook(() => useEnterpriseColors());
    act(() => result.current.setColor('sheep', '#aabbcc'));
    expect(result.current.colors.sheep).toBe('#aabbcc');
    expect(JSON.parse(store[LS_KEY]).sheep).toBe('#aabbcc');
  });
});
