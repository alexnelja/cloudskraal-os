import { describe, it, expect } from 'vitest';
import { formatDistance, formatArea } from './metricFormat';

describe('formatDistance', () => {
  it('handles null', () => expect(formatDistance(null)).toBe(''));
  it('integer meters below 1 km', () => expect(formatDistance(500)).toBe('500 m'));
  it('kilometers above 1 km', () => expect(formatDistance(2500)).toBe('2.50 km'));
});

describe('formatArea', () => {
  it('handles null', () => expect(formatArea(null)).toBe(''));
  it('integer m² below 1 ha', () => expect(formatArea(5000)).toBe('5000 m²'));
  it('hectares above 1 ha', () => expect(formatArea(12000)).toBe('1.20 ha'));
});
