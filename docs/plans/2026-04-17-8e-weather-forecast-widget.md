# Spec 8e — Weather Forecast Widget Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to execute task-by-task.

**Goal:** Add a 7-day weather forecast dashboard panel that fetches from Open-Meteo, shows daily cards with hourly drill-down, frost/heat alerts, and offline caching.

**Architecture:** Zero backend. New `weather.ts` API client fetches directly from Open-Meteo (CORS-friendly, no key). WMO weather codes mapped to Phosphor icons in a config file. `WeatherForecastPanel` component renders on Dashboard between EnterprisePriceCurve and Tasks. `HourlyStrip` sub-component uses recharts for the hourly temp/rain chart. Farm coordinates come from `getFarms()` (existing API).

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Recharts (already installed), `@phosphor-icons/react` (already installed).

**Spec:** `docs/specs/2026-04-17-spec-8e-weather-forecast-widget.md`

---

## Pre-flight

- [ ] **Step 0.1: Green baseline**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex/frontend
npm test
npx tsc -b --noEmit
```

All green before starting.

---

## File structure

| Path | Responsibility | Action |
|---|---|---|
| `frontend/src/api/weather.ts` | Open-Meteo fetch + types + localStorage cache | Create |
| `frontend/src/api/weather.test.ts` | Unit tests for the API client | Create |
| `frontend/src/config/weather-codes.ts` | WMO code → label + Phosphor icon map | Create |
| `frontend/src/config/weather-codes.test.ts` | Unit tests for the mapping | Create |
| `frontend/src/components/WeatherForecastPanel.tsx` | Main dashboard widget | Create |
| `frontend/src/components/WeatherForecastPanel.test.tsx` | Unit tests for the panel | Create |
| `frontend/src/components/HourlyStrip.tsx` | Scrollable hourly recharts sub-component | Create |
| `frontend/src/components/HourlyStrip.test.tsx` | Unit tests for the hourly strip | Create |
| `frontend/src/pages/Dashboard.tsx` | Wire WeatherForecastPanel into the page | Modify |

---

## Task 1 — Weather API client (TDD)

**Files:** `frontend/src/api/weather.ts` + `weather.test.ts`

Write tests first covering: successful fetch returns typed WeatherForecast, caches in localStorage on success, returns cached data when fetch fails, returns null when no cache and fetch fails, respects 3-hour TTL, fetches fresh when cache is stale.

Then implement `fetchForecast(lat, lng, farmId)` and `getCacheTimestamp(farmId)`.

Key implementation details:
- Open-Meteo URL: `https://api.open-meteo.com/v1/forecast`
- Cache TTL: 3 hours
- Fetch timeout: 8 seconds via AbortController
- Cache key: `weather_forecast_{farmId}`
- Query params: latitude, longitude, timezone=Africa/Johannesburg, forecast_days=7, hourly=temperature_2m,precipitation, daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,windspeed_10m_max,relative_humidity_2m_max

---

## Task 2 — WMO weather code mapping (TDD)

**Files:** `frontend/src/config/weather-codes.ts` + `weather-codes.test.ts`

Write tests first covering: code 0 → Clear sky/Sun, code 95 → Thunderstorm/Lightning, code 61 → Rain/CloudRain, unmapped code → Unknown/Cloud.

Then implement `getWeatherInfo(code)` returning `{ label: string, icon: Icon }`.

Full WMO mapping table in the spec.

---

## Task 3 — HourlyStrip sub-component (TDD)

**Files:** `frontend/src/components/HourlyStrip.tsx` + `HourlyStrip.test.tsx`

Write tests first: renders chart container when data provided, shows unavailable message when data is null.

Then implement using recharts ComposedChart with Line (temp, emerald) and Bar (rain, blue 40% opacity). Height 120px. Scrollable on mobile.

Props: `hours: string[] | null`, `temps: number[] | null`, `rain: number[] | null`.

---

## Task 4 — WeatherForecastPanel component (TDD)

**Files:** `frontend/src/components/WeatherForecastPanel.tsx` + `WeatherForecastPanel.test.tsx`

Write tests first: renders 7 day cards, shows frost alert when min < 2°C, shows heat alert when max > 38°C, shows empty state when no data, farm selector re-fetches on change.

Then implement. Key points:
- Farm selector dropdown from `getFarms()`
- 7 day cards in horizontal flex (overflow-x-auto on mobile)
- Each card: day label, weather icon, condition, high/low, rain, wind
- Selected card: emerald bottom border, loads HourlyStrip
- Frost/heat alert banners with Warning icon
- Stale indicator with CloudSlash icon
- Empty state with retry button
- Day labels: today → "Today", rest → weekday short name
- All temps as whole numbers (Math.round)

---

## Task 5 — Wire into Dashboard

**Files:** `frontend/src/pages/Dashboard.tsx`

Import WeatherForecastPanel. Insert between EnterprisePriceCurve and Tasks section in a `<div className="mb-6">` wrapper.

Run typecheck + full test suite.

---

## Task 6 — Commit + smoke

Single commit with all 8 new files + Dashboard.tsx modification.

Manual smoke checklist:
- Dashboard shows weather panel between price curve and tasks
- 7 day cards render with correct icons, temps as whole numbers
- Clicking card highlights it and loads hourly strip (today/tomorrow only)
- Farm selector works
- Offline: cached data shows with stale indicator
- Empty state with retry when no cache + offline
- Frost/heat alerts appear when thresholds met
- Responsive at 390 / 1280 / 1920 widths
