import type { Task } from '../types/calendar';

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

    // Wind rule: Crop Ops OR spray tasks, wind > 15 km/h → blocked
    if ((isCropOps || isSpray) && today.wind_speed_max > 15) {
      let clearsAt: string | null = null;
      for (let i = 0; i < forecast.length; i++) {
        if (forecast[i].wind_speed_max <= 15) {
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

    // Rain rule: Crop Ops OR harvest tasks, precipitation > 5mm → warning
    if ((isCropOps || isHarvest) && today.precipitation_sum > 5) {
      let clearsAt: string | null = null;
      for (let i = 0; i < forecast.length; i++) {
        if (forecast[i].precipitation_sum <= 5) {
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

    // Frost rule: Livestock Ops, temp < 2°C → warning
    if (isLivestock && today.temperature_min < 2) {
      let clearsAt: string | null = null;
      for (let i = 0; i < forecast.length; i++) {
        if (forecast[i].temperature_min >= 2) {
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

    // Heat rule: any task, temp > 38°C → warning
    if (today.temperature_max > 38) {
      let clearsAt: string | null = null;
      for (let i = 0; i < forecast.length; i++) {
        if (forecast[i].temperature_max <= 38) {
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
