import { useState, useEffect, useCallback } from 'react';
import { getFarms } from '../api/farms';
import { fetchForecast, clearForecastCache } from '../api/weather';
import { updateTask } from '../api/calendar';
import type { Task } from '../types/calendar';
import { evaluateWeatherBlocks, type WeatherBlock, type WeatherData } from '../lib/weatherBlocking';

export function useWeatherBlocking(tasks: Task[], loading: boolean) {
  const [weatherBlocks, setWeatherBlocks] = useState<WeatherBlock[]>([]);
  const [weatherToday, setWeatherToday] = useState<WeatherData | null>(null);

  const loadWeather = useCallback(
    async (taskList: Task[]) => {
      try {
        const farms = await getFarms();
        if (farms.length === 0 || farms[0].lat == null || farms[0].lng == null) return;
        const farm = farms[0];
        const result = await fetchForecast(farm.lat, farm.lng, farm.id);
        if (!result) return;

        const { daily } = result.data;
        const todayData: WeatherData = {
          wind_speed_max: daily.windspeed_10m_max[0] ?? 0,
          precipitation_sum: daily.precipitation_sum[0] ?? 0,
          temperature_min: daily.temperature_2m_min[0] ?? 10,
          temperature_max: daily.temperature_2m_max[0] ?? 25,
        };
        setWeatherToday(todayData);

        const forecast: WeatherData[] = daily.time.slice(1).map((_: any, i: number) => ({
          wind_speed_max: daily.windspeed_10m_max[i + 1] ?? 0,
          precipitation_sum: daily.precipitation_sum[i + 1] ?? 0,
          temperature_min: daily.temperature_2m_min[i + 1] ?? 10,
          temperature_max: daily.temperature_2m_max[i + 1] ?? 25,
        }));

        const blocks = evaluateWeatherBlocks(taskList, todayData, forecast);
        setWeatherBlocks(blocks);

        for (const block of blocks) {
          if (block.severity === 'blocked') {
            await updateTask(block.taskId, {
              blocked_reason: block.message,
              blocked_until: block.clearsAt,
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.error('Weather fetch failed:', err);
      }
    },
    [],
  );

  useEffect(() => {
    if (!loading && tasks.length > 0) {
      loadWeather(tasks);
    }
  }, [loading, tasks, loadWeather]);

  const handleWeatherRefresh = useCallback(async () => {
    try {
      const farms = await getFarms();
      if (farms.length > 0) clearForecastCache(farms[0].id);
    } catch { /* ignore */ }
    loadWeather(tasks);
  }, [tasks, loadWeather]);

  return {
    weatherBlocks,
    weatherToday,
    handleWeatherRefresh,
  };
}
