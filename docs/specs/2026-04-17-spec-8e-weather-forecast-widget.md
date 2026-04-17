# Spec 8e — 7-day weather forecast widget (dashboard panel)

- **Status:** Approved for planning (2026-04-17).
- **Parent:** Spec 8 (benched) — Weather & climate data.
- **Scope:** Frontend-only dashboard widget. No backend changes, no DB migration, no API key required.
- **Related:** Spec 8a (daily ingestion) is benched; 8e is intentionally decoupled — it fetches directly from Open-Meteo on the client side.

## Problem

The operator has zero weather awareness inside the app. Rainfall, frost, and heat stress directly affect rooibos yield, spray timing, and lamb survival in the Cederberg. Currently Alex alt-tabs to a weather app or SAWS. The dashboard — the app's landing page — has no weather context alongside CapEx metrics and task lists.

## Goal

Add a self-contained weather forecast panel to the dashboard that shows a 7-day daily forecast for the selected farm, with drill-down hourly detail for any selected day. Frost and heat alerts surface automatically. The widget works offline (cached last fetch) and degrades gracefully when the API is unreachable.

## Data source

**Open-Meteo free API** — `https://api.open-meteo.com/v1/forecast`

- No API key required.
- CORS-friendly (direct browser fetch).
- Rate limit: effectively unlimited for single-user Electron app.
- Cederberg default coordinates: lat `-32.3`, lng `19.0` (overridden per farm from `farms.lat` / `farms.lng`).

### Variables to fetch

**Daily (7 days):**
| Variable | Use |
|---|---|
| `temperature_2m_max` | High temp on forecast card |
| `temperature_2m_min` | Low temp on forecast card |
| `precipitation_sum` | Rain mm on forecast card |
| `weathercode` | WMO code → icon + label |
| `windspeed_10m_max` | Wind speed on forecast card |
| `relative_humidity_2m_max` | Humidity (display as whole percentage) |

**Hourly (today + tomorrow only, to limit payload):**
| Variable | Use |
|---|---|
| `temperature_2m` | Hourly temp line in strip chart |
| `precipitation` | Hourly rain bars in strip chart |

Query parameters: `&timezone=Africa/Johannesburg&forecast_days=7&hourly=temperature_2m,precipitation&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,windspeed_10m_max,relative_humidity_2m_max`

Hourly data is sliced client-side to only render the selected day's 24 hours.

## UI

### Farm selector

- Dropdown at the top-right of the panel header.
- Populated from `getFarms()` (already used elsewhere in the app).
- Defaults to the first farm in the list.
- On change, re-fetches forecast for the new farm's `lat`/`lng`.

### 7-day daily forecast cards

A horizontal row of 7 cards (scrollable on mobile). Each card shows:

| Element | Detail |
|---|---|
| Day label | `Mon`, `Tue`, etc. — today's card says `Today` |
| Weather icon | Phosphor icon mapped from WMO weather code |
| Condition label | Short text, e.g. "Partly cloudy" |
| High / Low | `24° / 8°` — whole numbers, no decimals |
| Rain | `3 mm` — whole number; hidden if 0 |
| Wind | `28 km/h` — whole number |

Selected card (click/tap) gets an emerald bottom border (`border-b-2 border-emerald-600`) and loads that day's hourly strip below.

### Hourly strip (sub-component)

- Scrollable horizontal chart for the selected day (24 data points).
- Uses recharts `ResponsiveContainer` + `ComposedChart` with:
  - `Line` for temperature (emerald stroke, `#047857`).
  - `Bar` for precipitation (blue fill, `#0ea5e9`, 40% opacity).
- X-axis: hours (`00`, `03`, `06`, ... `21`).
- Y-axes: left for temp (°C), right for rain (mm).
- Container height: 120px.
- Only rendered when hourly data is available for the selected day (today/tomorrow). For days 3-7, show a muted message: "Hourly detail available for today and tomorrow only."

### Frost / heat alerts

- **Frost alert**: when any day's `temperature_2m_min < 2°C` — amber banner at top of panel: `Frost risk on {day}: {temp}°C low`.
- **Heat alert**: when any day's `temperature_2m_max > 38°C` — red banner: `Heat stress on {day}: {temp}°C high`.
- Uses Phosphor `Warning` icon.
- Multiple alerts stack vertically (max 2-3 visible, rest behind "Show all" toggle).

### WMO weather code → icon mapping

WMO codes (0-99) mapped to Phosphor weather icons:

| Code range | Condition | Phosphor icon |
|---|---|---|
| 0 | Clear sky | `Sun` |
| 1 | Mainly clear | `SunHorizon` |
| 2 | Partly cloudy | `CloudSun` |
| 3 | Overcast | `Cloud` |
| 45, 48 | Fog / rime fog | `CloudFog` |
| 51, 53, 55 | Drizzle | `CloudRain` |
| 56, 57 | Freezing drizzle | `Snowflake` |
| 61, 63, 65 | Rain | `CloudRain` |
| 66, 67 | Freezing rain | `Snowflake` |
| 71, 73, 75, 77 | Snow | `Snowflake` |
| 80, 81, 82 | Rain showers | `CloudRain` |
| 85, 86 | Snow showers | `Snowflake` |
| 95, 96, 99 | Thunderstorm | `Lightning` |

Fallback for unmapped codes: `Cloud` icon, label "Unknown".

## Layout

The widget renders as a new section on `Dashboard.tsx`, inserted **between the EnterprisePriceCurve and the Tasks section**. It uses the same `bg-white rounded-2xl` card pattern as existing dashboard panels.

Full width of the dashboard content area. On `lg+` screens, the 7 cards sit in a single row. On mobile (`< 768px`), the cards row is horizontally scrollable with `overflow-x-auto`.

## Offline / caching

- On successful fetch, store the full API response + timestamp in `localStorage` under key `weather_forecast_{farmId}`.
- On mount, if cached data exists and is < 3 hours old, use it immediately (no fetch). Otherwise fetch fresh.
- If fetch fails and cache exists (any age), display cached data with a stale indicator: muted text below the header — "Last updated {relative time ago}" with a `CloudSlash` Phosphor icon.
- If fetch fails and no cache exists, show a friendly empty state: "Weather data unavailable. Check your connection." with a retry button.

## Error handling

- Network timeout: 8 seconds.
- Non-2xx response: treat as network error, fall back to cache.
- Malformed JSON: catch, log to console, fall back to cache.
- Farm with no coordinates (lat/lng both 0 or null): show "No location set for this farm. Add coordinates on the Map page."

## Design tokens

The panel uses the same surface as the rest of the dashboard (not the glass-panel tokens, which are map-overlay-specific). Specifically:
- Container: `bg-white rounded-2xl p-5`
- Header label: `text-[11px] font-bold uppercase tracking-[0.05em] text-[#6e7a73]`
- Emerald accents for selected states and the temp chart line.
- All icons: Phosphor, `weight="regular"`, `size={18}` for card icons, `size={16}` for header/alert icons.

## Tests (TDD, tests first)

1. **`weather.test.ts`** — API client
   - `fetchForecast(lat, lng)` returns typed `WeatherForecast` on success.
   - Caches response in localStorage on success.
   - Returns cached data when fetch throws and cache exists.
   - Returns `null` when fetch throws and no cache.
   - Respects 3-hour cache TTL (fresh cache skips fetch).

2. **`weather-codes.test.ts`** — WMO mapping
   - Maps code 0 → `{ label: 'Clear sky', icon: Sun }`.
   - Maps code 95 → `{ label: 'Thunderstorm', icon: Lightning }`.
   - Unmapped code (e.g. 99) returns fallback.

3. **`WeatherForecastPanel.test.tsx`** — main widget
   - Renders 7 day cards when data is loaded.
   - Shows frost alert banner when min temp < 2°C.
   - Shows heat alert banner when max temp > 38°C.
   - Shows stale indicator when using cached data.
   - Shows empty state when no data and no cache.
   - Farm selector calls `fetchForecast` with new farm's coordinates on change.

4. **`HourlyStrip.test.tsx`** — hourly chart
   - Renders chart with 24 data points for selected day.
   - Shows "Hourly detail available for today and tomorrow only" for day index >= 2.

## Risks

- **Open-Meteo availability.** Free service with no SLA. Mitigation: aggressive caching + graceful offline fallback.
- **Dashboard bundle size.** Recharts is already in the bundle; Phosphor weather icons are tree-shaken. No new dependencies. Negligible impact.
- **Farm coordinates accuracy.** Some farms may have approximate coordinates. Acceptable for Cederberg (~30 km across; Open-Meteo grid ~11 km).
- **Timezone handling.** Open-Meteo returns data in requested timezone (`Africa/Johannesburg`). No UTC conversion needed.

## Files changed

| File | Change |
|---|---|
| `frontend/src/api/weather.ts` (new) | Open-Meteo fetch client + types + localStorage cache |
| `frontend/src/api/weather.test.ts` (new) | Unit tests for the client |
| `frontend/src/config/weather-codes.ts` (new) | WMO code → label + Phosphor icon mapping |
| `frontend/src/config/weather-codes.test.ts` (new) | Unit tests for the mapping |
| `frontend/src/components/WeatherForecastPanel.tsx` (new) | Main dashboard widget |
| `frontend/src/components/WeatherForecastPanel.test.tsx` (new) | Unit tests for the panel |
| `frontend/src/components/HourlyStrip.tsx` (new) | Scrollable hourly chart sub-component |
| `frontend/src/components/HourlyStrip.test.tsx` (new) | Unit tests for the hourly strip |
| `frontend/src/pages/Dashboard.tsx` | Import + render `WeatherForecastPanel` between price curve and tasks |

No backend changes. No new dependencies. No DB migration.

## Success criteria

- Dashboard shows a 7-day forecast panel for the selected farm.
- Clicking a day card loads the hourly strip (today/tomorrow only).
- Frost/heat alerts appear when thresholds are breached.
- Widget works offline with cached data + stale indicator.
- All automated tests green: 4 new test files + existing suite.
- `npx tsc -b --noEmit` clean.
- Temperatures displayed as whole numbers, no decimals.
- Manual smoke passes at 390 / 1280 / 1920 widths.
