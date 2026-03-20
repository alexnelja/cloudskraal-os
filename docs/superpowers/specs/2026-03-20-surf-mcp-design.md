# Surf Forecast MCP Server — Design Spec

## Overview

A standalone Python MCP server (`surf-mcp`) that exposes surf and marine forecast data to LLM clients. Built with FastMCP and powered by free APIs (Open-Meteo, NOAA CO-OPS). Designed for trip planning — comparing conditions across multiple spots over a 7-day window with hourly granularity.

## Architecture

```
surf-mcp/
├── surf_mcp/
│   ├── __init__.py
│   ├── server.py          # FastMCP server, tool definitions
│   ├── open_meteo.py      # API client for Open-Meteo marine + weather
│   ├── noaa.py            # NOAA CO-OPS tide client + station resolution
│   ├── location.py        # Location resolution (auto-detect, named spots, coords)
│   └── spots.py           # Built-in surf spot registry
├── tests/
├── pyproject.toml
└── README.md
```

### Data Flow

1. Claude calls a tool (e.g., `get_surf_forecast(location="Mavericks")`)
2. `location.py` resolves the location to lat/lon via spot registry, geocoding, or IP geolocation
3. `open_meteo.py` fetches 7-day hourly marine + weather data (with `timezone` param set to spot's local timezone)
4. `noaa.py` finds the nearest NOAA tide station and fetches predictions (US only)
5. Server formats and returns structured JSON forecast to Claude

## Timezone Handling

All times are returned in the **spot's local timezone**. The timezone is determined by passing `timezone=auto` to Open-Meteo, which resolves timezone from coordinates. The timezone name (e.g., `"America/Los_Angeles"`) is included in the response so Claude can reason about cross-timezone comparisons.

For `compare_spots`, each spot's times are in its own local timezone, with the timezone name included per-spot so differences are explicit.

## Tools

### `get_surf_forecast`

- **Input:** `location` (string — `"auto"`, spot name like `"Mavericks"`, or `"lat,lon"`)
- **Output:** 7-day hourly forecast per day
- **Hourly fields:** wave height (m), wave period (s), wave direction (deg), wind speed (km/h), wind direction (deg), tide height (m or null), condition rating (1-5)
- **Daily fields:** sunrise, sunset
- **Notes:** Tide data included for US locations via NOAA, `null` for non-US with a `tide_note` field. Water temp omitted (not available from Open-Meteo marine). Each hour includes a `condition_rating` (1-5 integer, see Condition Rating section).

### `compare_spots`

- **Input:** `locations` (list of 1-5 spot names/coords), `date` (optional — ISO 8601 string like `"2026-03-22"`, defaults to today. Returns error if outside 7-day window)
- **Output:** Side-by-side daily summary per spot (see output schema below)
- **`best_hours`:** The hours with the highest condition rating for that spot on that day. Specifically, all daylight hours (between sunrise and sunset) with a condition rating >= 3 ("Good" or better). If no hours reach 3, returns the top 3 hours by rating.
- **Behavior with 1 spot:** Returns that single spot's summary — no error.

### `find_best_window`

- **Input:** `locations` (list of spot names/coords), `min_wave_height` (optional, meters, default 0), `max_wind_speed` (optional, km/h, default unlimited), `date` (optional — ISO 8601 string to constrain to a single day, or omit to search full 7-day range)
- **Output:** Top 10 best windows, ranked by condition rating (see output schema below)
- **Window definition:** A contiguous block of 2+ hours where all thresholds are met. Windows are merged if separated by only 1 hour that barely misses thresholds.
- **No matches:** Returns empty list with message "No windows matching your criteria found in the 7-day forecast."

## Condition Rating

A simple 1-5 score computed per hour, then averaged over a window.

**Formula:** `score = wave_height_m × wave_period_s / max(wind_speed_kmh, 5)`

The `max(..., 5)` floor prevents division by zero and avoids inflating scores in dead-calm conditions (no wind doesn't mean good surf if waves are small).

**Rating buckets:**

| Score Range | Rating | Label |
|-------------|--------|-------|
| < 2         | 1      | Poor  |
| 2 – 4       | 2      | Fair  |
| 4 – 8       | 3      | Good  |
| 8 – 15      | 4      | Great |
| > 15        | 5      | Epic  |

The `rating_label` field in tool responses maps directly from this table (e.g., rating 4 → `"Great"`).

This is a rough heuristic. It intentionally ignores swell direction (spot-dependent, hard to generalize) and tide state (preference varies by break type). Claude can layer its own judgment on top.

## Location Resolution

Resolved in order:

1. **`"auto"` / omitted** — IP geolocation via `ip-api.com/json` (free, no key). **Limitation:** resolves to ISP location, not physical location — may be tens of miles off. If the resolved location is >50km from coast, snap to the nearest spot in the registry and note this in the response.
2. **Named spot** — Looked up in built-in registry (`spots.py`), case-insensitive. Ships with ~20 spots (California, Hawaii, international).
3. **Coordinates** — Raw `"36.49,-121.94"` passed through directly.
4. **Unknown name** — Falls back to Open-Meteo geocoding API (`geocoding-api.open-meteo.com`) to resolve to coords. If that fails, returns an error.

### Spot Registry (sample)

```python
SPOTS = {
    "mavericks": (37.49, -122.50),
    "ocean beach": (37.76, -122.51),
    "steamer lane": (36.95, -122.02),
    "pipeline": (21.66, -158.05),
    "trestles": (33.38, -117.59),
    # ... ~15 more
}
```

## API Integration

### Open-Meteo Marine (`marine-api.open-meteo.com/v1/marine`)

- Params: `latitude`, `longitude`, `hourly=wave_height,wave_period,wave_direction`, `forecast_days=7`, `timezone=auto`
- Provides: wave height (total), wave period (dominant), wave direction (hourly)
- Note: We fetch only `wave_height`, `wave_period`, `wave_direction` (total/dominant values). Swell-specific breakdowns (`swell_wave_*`) are not exposed in the output — the total values are sufficient for trip planning.

### Open-Meteo Weather (`api.open-meteo.com/v1/forecast`)

- Params: `latitude`, `longitude`, `hourly=wind_speed_10m,wind_direction_10m`, `daily=sunrise,sunset`, `forecast_days=7`, `timezone=auto`
- Provides: wind speed, wind direction (hourly), sunrise/sunset (daily)

### NOAA CO-OPS Tides

**Base URL:** `tidesandcurrents.noaa.gov/api/datagetter`

**Station resolution:** NOAA requires a station ID, not raw coordinates. Strategy:
1. Fetch station list from `tidesandcurrents.noaa.gov/mdapi/latest/webapi/stations.json?type=tidepredictions`
2. Cache the station list in memory on first call (it rarely changes)
3. Find the nearest station to the requested lat/lon using haversine distance
4. If nearest station is >50km away, skip tides with a note

**Prediction request params:**
- `station` — resolved station ID
- `product=predictions`
- `datum=MLLW`
- `units=metric`
- `time_zone=lst_ldt` (local standard/daylight time)
- `format=json`
- `begin_date` / `end_date` — 7-day window, format `YYYYMMDD`
- `interval=h` (hourly)

**For non-US locations:** Skip tide data, include `"tide_note": "Tide data unavailable for this location (non-US)"`

### Rate Limits

- Open-Meteo: 10,000 requests/day (free). `compare_spots` with 5 spots = 10 calls (2 per spot). Well within limits.
- NOAA: No documented rate limit for predictions endpoint. Station list cached after first fetch.
- ip-api.com: 45 requests/minute (free tier). Only called on auto-detect.

## Output Format

### `get_surf_forecast` response

```json
{
  "spot": "Mavericks",
  "coordinates": [37.49, -122.50],
  "timezone": "America/Los_Angeles",
  "tide_source": "NOAA CO-OPS (station 9414290, San Francisco)",
  "forecast": [
    {
      "date": "2026-03-20",
      "sunrise": "07:12",
      "sunset": "19:21",
      "hours": [
        {
          "time": "06:00",
          "wave_height_m": 2.1,
          "wave_period_s": 14,
          "wave_direction_deg": 285,
          "wind_speed_kmh": 12,
          "wind_direction_deg": 320,
          "tide_height_m": 1.4,
          "condition_rating": 4
        }
      ]
    }
  ]
}
```

### `compare_spots` response

```json
{
  "date": "2026-03-22",
  "spots": [
    {
      "spot": "Mavericks",
      "coordinates": [37.49, -122.50],
      "timezone": "America/Los_Angeles",
      "peak_wave_height_m": 3.2,
      "best_hours": ["06:00", "07:00", "08:00"],
      "avg_wind_speed_kmh": 14,
      "avg_condition_rating": 4,
      "rating_label": "Great"
    },
    {
      "spot": "Ocean Beach",
      "coordinates": [37.76, -122.51],
      "timezone": "America/Los_Angeles",
      "peak_wave_height_m": 1.8,
      "best_hours": ["07:00", "08:00"],
      "avg_wind_speed_kmh": 18,
      "avg_condition_rating": 2,
      "rating_label": "Fair"
    }
  ]
}
```

### `find_best_window` response

```json
{
  "filters": {
    "min_wave_height_m": 1.5,
    "max_wind_speed_kmh": 20
  },
  "windows": [
    {
      "rank": 1,
      "spot": "Mavericks",
      "date": "2026-03-21",
      "start_time": "06:00",
      "end_time": "10:00",
      "duration_hours": 4,
      "timezone": "America/Los_Angeles",
      "avg_wave_height_m": 2.8,
      "avg_wave_period_s": 13,
      "avg_wind_speed_kmh": 10,
      "avg_condition_rating": 4,
      "rating_label": "Great"
    }
  ],
  "message": null
}
```

When no windows match: `"windows": []` and `"message": "No windows matching your criteria found in the 7-day forecast."`

## Error Handling

- **API down:** "Open-Meteo marine API unreachable. Try again shortly."
- **Unknown spot + geocoding fails:** "Could not find location 'xyz'. Try coordinates (lat,lon) or a known spot name."
- **Landlocked coords:** "No marine data available for this location."
- **NOAA tide miss:** Nearest station >50km or non-US. Return forecast with `tide_height_m: null` and `tide_note` field.
- **`date` outside 7-day window:** "Date 'YYYY-MM-DD' is outside the 7-day forecast window. Valid range: [start] to [end]."
- **Auto-detect far from coast:** Snap to nearest registry spot, include note: "Auto-detected location [city] is far from coast. Showing nearest spot: [name]."
- No retries or caching for v1 (except NOAA station list).

## Installation & Configuration

### Dependencies

- `fastmcp` — MCP framework
- `httpx` — async HTTP client
- Python 3.10+

### No API keys required.

### Claude Code config

```json
{
  "mcpServers": {
    "surf-forecast": {
      "command": "python",
      "args": ["-m", "surf_mcp.server"],
      "cwd": "/path/to/surf-mcp"
    }
  }
}
```

## Out of Scope (v1)

- Water temperature (not available from Open-Meteo marine)
- General weather (air temp, rain, UV)
- International tide data (would need worldtides.info or similar paid service)
- Caching / retries (except NOAA station list)
- Alerts / notifications
- Swell direction relative to spot orientation (spot-specific, hard to generalize)
