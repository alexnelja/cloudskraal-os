import { describe, it, expect } from 'vitest';
import { todayUTC, CLOUDSKRAAL_TIMEZONE } from '../src/utils/dates.js';

describe('dates util', () => {
  it('todayUTC returns ISO YYYY-MM-DD', () => {
    const today = todayUTC();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(today).toBe(new Date().toISOString().split('T')[0]);
  });

  it('CLOUDSKRAAL_TIMEZONE is Africa/Johannesburg', () => {
    expect(CLOUDSKRAAL_TIMEZONE).toBe('Africa/Johannesburg');
  });
});
