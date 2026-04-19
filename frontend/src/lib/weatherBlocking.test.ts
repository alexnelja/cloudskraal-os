import { describe, it, expect } from 'vitest';
import { evaluateWeatherBlocks, type WeatherData } from './weatherBlocking';
import type { Task } from '../types/calendar';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Generic task',
    description: null,
    enterprise: null,
    field_id: null,
    type: 'manual',
    status: 'pending',
    priority: 'medium',
    due_date: '2026-04-17',
    completed_date: null,
    completed_by: null,
    assigned_to: null,
    depends_on_task_id: null,
    recurrence_rule: null,
    calendar_event_id: null,
    notes: null,
    status_id: null,
    estimated_minutes: null,
    actual_minutes: null,
    blocked_reason: null,
    blocked_until: null,
    sort_order: 0,
    verified_by: null,
    verified_at: null,
    tags: [],
    ...overrides,
  };
}

const calm: WeatherData = {
  wind_speed_max: 8,
  precipitation_sum: 0,
  temperature_min: 12,
  temperature_max: 24,
};

const calmForecast: WeatherData[] = [calm, calm, calm];

describe('evaluateWeatherBlocks', () => {
  it('returns empty array when no weather issues', () => {
    const tasks = [
      makeTask({ tags: [{ id: '1', name: 'Crop Ops', color: '#0f0', group: 'ops' }] }),
    ];
    const result = evaluateWeatherBlocks(tasks, calm, calmForecast);
    expect(result).toEqual([]);
  });

  it('blocks spray task when wind > 15 km/h', () => {
    const tasks = [
      makeTask({ id: 'spray-1', title: 'Spray herbicide on Block 5A' }),
    ];
    const windy: WeatherData = { ...calm, wind_speed_max: 22 };
    const result = evaluateWeatherBlocks(tasks, windy, calmForecast);
    expect(result).toHaveLength(1);
    expect(result[0].taskId).toBe('spray-1');
    expect(result[0].reason).toBe('weather_wind');
    expect(result[0].severity).toBe('blocked');
    expect(result[0].message).toContain('22');
  });

  it('blocks Crop Ops tagged task when wind > 15 km/h', () => {
    const tasks = [
      makeTask({
        id: 'crop-1',
        title: 'Apply fungicide',
        tags: [{ id: '1', name: 'Crop Ops', color: '#0f0', group: 'ops' }],
      }),
    ];
    const windy: WeatherData = { ...calm, wind_speed_max: 18 };
    const result = evaluateWeatherBlocks(tasks, windy, calmForecast);
    expect(result.some((b) => b.reason === 'weather_wind')).toBe(true);
  });

  it('warns harvest task when precipitation > 5mm', () => {
    const tasks = [
      makeTask({ id: 'h-1', title: 'Harvest rooibos field 3' }),
    ];
    const rainy: WeatherData = { ...calm, precipitation_sum: 12 };
    const result = evaluateWeatherBlocks(tasks, rainy, calmForecast);
    expect(result).toHaveLength(1);
    expect(result[0].taskId).toBe('h-1');
    expect(result[0].reason).toBe('weather_rain');
    expect(result[0].severity).toBe('warning');
  });

  it('warns Crop Ops tagged task when precipitation > 5mm', () => {
    const tasks = [
      makeTask({
        id: 'crop-2',
        title: 'Harvest oats',
        tags: [{ id: '1', name: 'Crop Ops', color: '#0f0', group: 'ops' }],
      }),
    ];
    const rainy: WeatherData = { ...calm, precipitation_sum: 8 };
    const result = evaluateWeatherBlocks(tasks, rainy, calmForecast);
    expect(result.some((b) => b.reason === 'weather_rain')).toBe(true);
  });

  it('warns livestock task on frost (< 2°C)', () => {
    const tasks = [
      makeTask({
        id: 'lv-1',
        title: 'Move ewes to paddock',
        tags: [{ id: '2', name: 'Livestock Ops', color: '#f00', group: 'ops' }],
      }),
    ];
    const frosty: WeatherData = { ...calm, temperature_min: -1 };
    const result = evaluateWeatherBlocks(tasks, frosty, calmForecast);
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe('weather_frost');
    expect(result[0].severity).toBe('warning');
  });

  it('warns on heat (> 38°C) for any task', () => {
    const tasks = [makeTask({ id: 'any-1', title: 'Fix fence' })];
    const hot: WeatherData = { ...calm, temperature_max: 42 };
    const result = evaluateWeatherBlocks(tasks, hot, calmForecast);
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe('weather_heat');
    expect(result[0].severity).toBe('warning');
    expect(result[0].message).toContain('42');
  });

  it('finds clearsAt date from forecast', () => {
    const tasks = [
      makeTask({ id: 'spray-2', title: 'Spray pesticide' }),
    ];
    const windy: WeatherData = { ...calm, wind_speed_max: 20 };
    const forecast: WeatherData[] = [
      { ...calm, wind_speed_max: 18 }, // day +1: still windy
      { ...calm, wind_speed_max: 10 }, // day +2: clears
      calm,
    ];
    const result = evaluateWeatherBlocks(tasks, windy, forecast);
    expect(result).toHaveLength(1);
    // clearsAt should be 2 days from today (index 1 in forecast = day+2)
    expect(result[0].clearsAt).not.toBeNull();
  });

  it('returns null clearsAt when condition never clears in forecast', () => {
    const tasks = [makeTask({ id: 'spray-3', title: 'Spray weeds' })];
    const windy: WeatherData = { ...calm, wind_speed_max: 20 };
    const windyForecast = [windy, windy, windy];
    const result = evaluateWeatherBlocks(tasks, windy, windyForecast);
    expect(result[0].clearsAt).toBeNull();
  });

  it('ignores tasks without relevant tags for tag-specific rules', () => {
    const tasks = [
      makeTask({
        id: 'gen-1',
        title: 'Fix fence',
        tags: [{ id: '3', name: 'Maintenance', color: '#00f', group: 'ops' }],
      }),
    ];
    const windy: WeatherData = { ...calm, wind_speed_max: 25 };
    const rainy: WeatherData = { ...calm, precipitation_sum: 10 };
    // Wind rule only applies to Crop Ops / spray tasks
    const windResult = evaluateWeatherBlocks(tasks, windy, calmForecast);
    expect(windResult.filter((b) => b.reason === 'weather_wind')).toHaveLength(0);
    // Rain rule only applies to Crop Ops / harvest tasks
    const rainResult = evaluateWeatherBlocks(tasks, rainy, calmForecast);
    expect(rainResult.filter((b) => b.reason === 'weather_rain')).toHaveLength(0);
  });

  it('handles tasks with no tags gracefully', () => {
    const tasks = [makeTask({ id: 'nt-1', title: 'Dig trench', tags: undefined })];
    const windy: WeatherData = { ...calm, wind_speed_max: 25 };
    // Should not throw, and should not produce wind/rain/frost blocks
    const result = evaluateWeatherBlocks(tasks, windy, calmForecast);
    expect(result.filter((b) => b.reason === 'weather_wind')).toHaveLength(0);
    expect(result.filter((b) => b.reason === 'weather_frost')).toHaveLength(0);
  });
});
