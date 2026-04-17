import { useCallback, useSyncExternalStore } from 'react';
import { ENTERPRISE_COLORS } from '../types/farm';

const LS_KEY = 'capex.enterprise-colors';

type ColorMap = Record<string, string>;

let cache: ColorMap | null = null;

function loadOverrides(): ColorMap {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as ColorMap;
  } catch { /* noop */ }
  return {};
}

function getOverrides(): ColorMap {
  if (!cache) cache = loadOverrides();
  return cache;
}

function getMerged(): ColorMap {
  return { ...ENTERPRISE_COLORS, ...getOverrides() };
}

let snapshot = getMerged();

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return snapshot;
}

function setColor(enterprise: string, color: string) {
  const overrides = { ...getOverrides(), [enterprise]: color };
  cache = overrides;
  snapshot = { ...ENTERPRISE_COLORS, ...overrides };
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(overrides));
  } catch { /* noop */ }
  listeners.forEach((cb) => cb());
}

function resetColor(enterprise: string) {
  const overrides = { ...getOverrides() };
  delete overrides[enterprise];
  cache = overrides;
  snapshot = { ...ENTERPRISE_COLORS, ...overrides };
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(overrides));
  } catch { /* noop */ }
  listeners.forEach((cb) => cb());
}

export function useEnterpriseColors() {
  const colors = useSyncExternalStore(subscribe, getSnapshot);
  const set = useCallback((ent: string, color: string) => setColor(ent, color), []);
  const reset = useCallback((ent: string) => resetColor(ent), []);
  return { colors, setColor: set, resetColor: reset };
}
