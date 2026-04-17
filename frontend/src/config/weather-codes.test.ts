import { describe, it, expect } from 'vitest';
import { getWeatherInfo } from './weather-codes';
import { Sun, Lightning, Cloud, CloudRain } from '@phosphor-icons/react';

describe('getWeatherInfo', () => {
  it('maps code 0 to Clear sky with Sun icon', () => {
    const info = getWeatherInfo(0);
    expect(info.label).toBe('Clear sky');
    expect(info.icon).toBe(Sun);
  });

  it('maps code 95 to Thunderstorm with Lightning icon', () => {
    const info = getWeatherInfo(95);
    expect(info.label).toBe('Thunderstorm');
    expect(info.icon).toBe(Lightning);
  });

  it('maps code 61 to Rain with CloudRain icon', () => {
    const info = getWeatherInfo(61);
    expect(info.label).toBe('Rain');
    expect(info.icon).toBe(CloudRain);
  });

  it('returns fallback for unmapped code 100', () => {
    const info = getWeatherInfo(100);
    expect(info.label).toBe('Unknown');
    expect(info.icon).toBe(Cloud);
  });

  it('maps code 99 to Thunderstorm (not fallback)', () => {
    const info = getWeatherInfo(99);
    expect(info.label).toBe('Thunderstorm');
    expect(info.icon).toBe(Lightning);
  });
});
