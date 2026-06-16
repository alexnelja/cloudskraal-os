import { describe, it, expect } from 'vitest';
import { markerPercent, classifyZone } from './gaugeMath';

describe('markerPercent', () => {
  it('maps value to 0–100% of the range', () => {
    expect(markerPercent(0, 0, 600)).toBe(0);
    expect(markerPercent(300, 0, 600)).toBe(50);
    expect(markerPercent(600, 0, 600)).toBe(100);
  });
  it('clamps below min and above max', () => {
    expect(markerPercent(-50, 0, 600)).toBe(0);
    expect(markerPercent(900, 0, 600)).toBe(100);
  });
});

describe('classifyZone', () => {
  const g = { min: 0, max: 10, goodMin: 0, goodMax: 8, threshold: 8 };
  it('over when value exceeds threshold', () => { expect(classifyZone(9, g)).toBe('over'); });
  it('good when within good band', () => { expect(classifyZone(3, g)).toBe('good'); });
  it('edge when outside good band but not over threshold', () => {
    expect(classifyZone(8.0, { ...g, goodMax: 6, threshold: 9 })).toBe('edge');
  });
  it('good by default when no bands defined', () => { expect(classifyZone(5, { min: 0, max: 10 })).toBe('good'); });
});
