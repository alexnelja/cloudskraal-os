import type { Task } from '../types/calendar';
import {
  WEATHER_WIND_THRESHOLD_KMH,
  WEATHER_RAIN_THRESHOLD_MM,
  WEATHER_FROST_THRESHOLD_C,
  WEATHER_HEAT_THRESHOLD_C,
} from '../constants';

export interface WeatherData {
  wind_speed_max: number;
  precipitation_sum: number;
  temperature_min: number;
  temperature_max: number;
}

export interface WeatherBlock {
  taskId: string;
  reason: 'weather_wind' | 'weather_rain' | 'weather_frost' | 'weather_heat';
  severity: 'blocked' | 'warning';
  message: string;
  clearsAt: string | null;
}

function hasCropOpsTag(task: Task): boolean {
  return task.tags?.some((t) => t.name === 'Crop Ops') ?? false;
}

function hasLivestockOpsTag(task: Task): boolean {
  return task.tags?.some((t) => t.name === 'Livestock Ops') ?? false;
}

function titleContains(task: Task, keyword: string): boolean {
  return task.title.toLowerCase().includes(keyword.toLowerCase());
}

function todayPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Pure function: evaluate weather conditions against tasks and return blocking info.
 * No side effects — caller is responsible for persisting blocks.
 */
export function evaluateWeatherBlocks(
  tasks: Task[],
  today: WeatherData,
  forecast: WeatherData[],
): WeatherBlock[] {
  const blocks: WeatherBlock[] = [];

  for (const task of tasks) {
    const isCropOps = hasCropOpsTag(task);
    const isSpray = titleContains(task, 'spray');
    const isHarvest = titleContains(task, 'harvest');
    const isLivestock = hasLivestockOpsTag(task);

    // Wind rule: Crop Ops OR spray tasks, wind > threshold → blocked
    if ((isCropOps || isSpray) && today.wind_speed_max > WEATHER_WIND_THRESHOLD_KMH) {
      let clearsAt: string | null = null;
      for (let i = 0; i < forecast.length; i++) {
        if (forecast[i].wind_speed_max <= WEATHER_WIND_THRESHOLD_KMH) {
          clearsAt = todayPlusDays(i + 1);
          break;
        }
      }
      blocks.push({
        taskId: task.id,
        reason: 'weather_wind',
        severity: 'blocked',
        message: `Wind ${today.wind_speed_max} km/h — too high for spraying/crop ops`,
        clearsAt,
      });
    }

    // Rain rule: Crop Ops OR harvest tasks, precipitation > threshold → warning
    if ((isCropOps || isHarvest) && today.precipitation_sum > WEATHER_RAIN_THRESHOLD_MM) {
      let clearsAt: string | null = null;
      for (let i = 0; i < forecast.length; i++) {
        if (forecast[i].precipitation_sum <= WEATHER_RAIN_THRESHOLD_MM) {
          clearsAt = todayPlusDays(i + 1);
          break;
        }
      }
      blocks.push({
        taskId: task.id,
        reason: 'weather_rain',
        severity: 'warning',
        message: `Rain ${today.precipitation_sum}mm — harvest/crop ops risk`,
        clearsAt,
      });
    }

    // Frost rule: Livestock Ops, temp < threshold → warning
    if (isLivestock && today.temperature_min < WEATHER_FROST_THRESHOLD_C) {
      let clearsAt: string | null = null;
      for (let i = 0; i < forecast.length; i++) {
        if (forecast[i].temperature_min >= WEATHER_FROST_THRESHOLD_C) {
          clearsAt = todayPlusDays(i + 1);
          break;
        }
      }
      blocks.push({
        taskId: task.id,
        reason: 'weather_frost',
        severity: 'warning',
        message: `Frost risk ${today.temperature_min}°C — livestock vulnerable`,
        clearsAt,
      });
    }

    // Heat rule: any task, temp > threshold → warning
    if (today.temperature_max > WEATHER_HEAT_THRESHOLD_C) {
      let clearsAt: string | null = null;
      for (let i = 0; i < forecast.length; i++) {
        if (forecast[i].temperature_max <= WEATHER_HEAT_THRESHOLD_C) {
          clearsAt = todayPlusDays(i + 1);
          break;
        }
      }
      blocks.push({
        taskId: task.id,
        reason: 'weather_heat',
        severity: 'warning',
        message: `Extreme heat ${today.temperature_max}°C — heat stress risk`,
        clearsAt,
      });
    }
  }

  return blocks;
}
