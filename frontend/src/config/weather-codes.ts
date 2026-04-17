import {
  Sun,
  SunHorizon,
  CloudSun,
  Cloud,
  CloudFog,
  CloudRain,
  Snowflake,
  Lightning,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';

export interface WeatherInfo {
  label: string;
  icon: Icon;
}

const codeMap: Record<number, WeatherInfo> = {
  0: { label: 'Clear sky', icon: Sun },
  1: { label: 'Mainly clear', icon: SunHorizon },
  2: { label: 'Partly cloudy', icon: CloudSun },
  3: { label: 'Overcast', icon: Cloud },
  45: { label: 'Fog', icon: CloudFog },
  48: { label: 'Fog', icon: CloudFog },
  51: { label: 'Drizzle', icon: CloudRain },
  53: { label: 'Drizzle', icon: CloudRain },
  55: { label: 'Drizzle', icon: CloudRain },
  56: { label: 'Freezing drizzle', icon: Snowflake },
  57: { label: 'Freezing drizzle', icon: Snowflake },
  61: { label: 'Rain', icon: CloudRain },
  63: { label: 'Rain', icon: CloudRain },
  65: { label: 'Rain', icon: CloudRain },
  66: { label: 'Freezing rain', icon: Snowflake },
  67: { label: 'Freezing rain', icon: Snowflake },
  71: { label: 'Snow', icon: Snowflake },
  73: { label: 'Snow', icon: Snowflake },
  75: { label: 'Snow', icon: Snowflake },
  77: { label: 'Snow', icon: Snowflake },
  80: { label: 'Rain showers', icon: CloudRain },
  81: { label: 'Rain showers', icon: CloudRain },
  82: { label: 'Rain showers', icon: CloudRain },
  85: { label: 'Snow showers', icon: Snowflake },
  86: { label: 'Snow showers', icon: Snowflake },
  95: { label: 'Thunderstorm', icon: Lightning },
  96: { label: 'Thunderstorm', icon: Lightning },
  99: { label: 'Thunderstorm', icon: Lightning },
};

const fallback: WeatherInfo = { label: 'Unknown', icon: Cloud };

export function getWeatherInfo(code: number): WeatherInfo {
  return codeMap[code] ?? fallback;
}
