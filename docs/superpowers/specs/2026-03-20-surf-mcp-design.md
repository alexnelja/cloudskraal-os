# Surf Forecast MCP Server — Design Spec

## Overview

A standalone Python MCP server (`surf-mcp`) that exposes surf and marine forecast data to LLM clients. Built with FastMCP and powered by free APIs (Open-Meteo, NOAA CO-OPS). Designed for trip planning — comparing conditions across multiple spots over a 7-day window with hourly granularity.

## Architecture

```
surf-mcp/
├── src/
│   ├── server.py          # FastMCP server, tool definitions
│   ├── open_meteo.py      # API client for Open-Meteo marine + weather
│   ├── location.py        # Location resolution (auto-detect, named spots, coords)
│   └── spots.py           # Built-in surf spot registry
├── tests/
├── pyproject.toml
└── README.md
```

### Data Flow

1. Claude calls a tool (e.g., `get_surf_forecast(location="Mavericks")`)
2. `location.py` resolves the location to lat/lon via spot registry, geocoding, or IP geolocation
3. `open_meteo.py` fetches 7-day hourly marine + weather data
4. NOAA CO-OPS provides tide data (US locations only)
5. Server formats and returns structured JSON forecast to Claude

## Tools

### `get_surf_forecast`

- **Input:** `location` (string — `"auto"`, spot name like `"Mavericks"`, or `"lat,lon"`)
- **Output:** 7-day hourly forecast per day
- **Hourly fields:** wave height (m), wave period (s), swell direction (deg), wind speed (km/h), wind direction (deg), tide height (m)
- **Daily fields:** sunrise, sunset
- **Notes:** Water temp not available from Open-Meteo marine — omitted. Tide data included for US locations via NOAA, noted as unavailable for non-US.

### `compare_spots`

- **Input:** `locations` (list of 2-5 spot names/coords), `date` (optional — defaults to today, any day within 7-day window)
- **Output:** Side-by-side daily summary per spot:
  - Peak wave height & best hours
  - Average wind speed
  - Condition rating (1-5, computed from wave height x period / wind)

### `find_best_window`

- **Input:** `locations` (list of spot names/coords), `min_wave_height` (optional, meters), `max_wind_speed` (optional, km/h)
- **Output:** Ranked list of best spot + time windows across the 7-day range, filtered by user preferences

## Location Resolution

Resolved in order:

1. **`"auto"` / omitted** — IP geolocation via `ip-api.com/json` (free, no key)
2. **Named spot** — Looked up in built-in registry (`spots.py`), case-insensitive. Ships with ~20 spots (California, Hawaii, international).
3. **Coordinates** — Raw `"36.49,-121.94"` passed through directly
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

- Params: `latitude`, `longitude`, `hourly=wave_height,wave_period,wave_direction,swell_wave_height,swell_wave_period,swell_wave_direction`, `forecast_days=7`
- Provides: wave height, period, swell direction (hourly)

### Open-Meteo Weather (`api.open-meteo.com/v1/forecast`)

- Params: `latitude`, `longitude`, `hourly=wind_speed_10m,wind_direction_10m`, `daily=sunrise,sunset`, `forecast_days=7`
- Provides: wind speed, wind direction (hourly), sunrise/sunset (daily)

### NOAA CO-OPS Tides (`tidesandcurrents.noaa.gov/api/v2`)

- Free, no key, US coastlines only
- Returns hourly tide predictions
- For non-US locations: omit tide data with note "Tide data unavailable for this location"

### Rate Limits

- Open-Meteo: 10,000 requests/day (free). `compare_spots` with 5 spots = 10 calls (2 per spot). Well within limits.
- NOAA: No documented rate limit for predictions endpoint.
- ip-api.com: 45 requests/minute (free tier). Only called on auto-detect.

## Output Format

### `get_surf_forecast` response

```json
{
  "spot": "Mavericks",
  "coordinates": [37.49, -122.50],
  "forecast": [
    {
      "date": "2026-03-20",
      "hours": [
        {
          "time": "06:00",
          "wave_height_m": 2.1,
          "wave_period_s": 14,
          "swell_direction_deg": 285,
          "wind_speed_kmh": 12,
          "wind_direction_deg": 320,
          "tide_height_m": 1.4
        }
      ],
      "sunrise": "07:12",
      "sunset": "19:21"
    }
  ],
  "tide_source": "NOAA CO-OPS"
}
```

### `compare_spots` response

Per-spot daily summary with peak wave height, best hours, average wind, and condition rating (1-5).

### `find_best_window` response

Ranked list of spot + time windows, filtered by user thresholds, sorted by condition rating.

## Error Handling

- **API down:** "Open-Meteo marine API unreachable. Try again shortly."
- **Unknown spot + geocoding fails:** "Could not find location 'xyz'. Try coordinates (lat,lon) or a known spot name."
- **Landlocked coords:** "No marine data available for this location."
- **NOAA tide miss (non-US):** Return forecast without tides, note: "Tide data unavailable for this location."
- **`compare_spots` with 1 spot:** Returns that spot's forecast, no error.
- No retries or caching for v1.

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
- Caching / retries
- Alerts / notifications
