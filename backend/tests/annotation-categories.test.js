import { describe, it, expect } from 'vitest';
import { CATEGORIES, isValidCategory } from '../src/services/annotationCategories.js';

describe('annotation categories', () => {
  it('defines non-empty lists for each type', () => {
    expect(CATEGORIES.pin.length).toBeGreaterThan(5);
    expect(CATEGORIES.line.length).toBeGreaterThan(3);
    expect(CATEGORIES.polygon.length).toBeGreaterThan(3);
  });

  it('each list contains generic as the fallback', () => {
    expect(CATEGORIES.pin).toContain('generic');
    expect(CATEGORIES.line).toContain('generic');
    expect(CATEGORIES.polygon).toContain('generic');
  });

  it('isValidCategory accepts known values per type', () => {
    expect(isValidCategory('pin', 'pump')).toBe(true);
    expect(isValidCategory('line', 'pipe')).toBe(true);
    expect(isValidCategory('polygon', 'dam')).toBe(true);
  });

  it('isValidCategory rejects cross-type values', () => {
    expect(isValidCategory('pin', 'dam')).toBe(false); // polygon-only
    expect(isValidCategory('polygon', 'pump')).toBe(false); // pin-only
  });

  it('isValidCategory accepts null/undefined (category is optional)', () => {
    expect(isValidCategory('pin', null)).toBe(true);
    expect(isValidCategory('pin', undefined)).toBe(true);
  });

  it('rejects unknown types entirely', () => {
    expect(isValidCategory('bogus', 'pump')).toBe(false);
  });
});
