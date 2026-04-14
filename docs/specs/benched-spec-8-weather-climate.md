# Spec 8 (benched) — Weather & climate data

- **Status:** Scope documented, full brainstorming + plan deferred.
- **Scope:** New top-level module. Independent of GIS and COP families. Feeds both.

## Problem

Rainfall correlates with rooibos yield. Heat stress affects wool and lamb survival. Spray windows need wind + rain forecast. Currently the app has zero weather awareness. Operator manually watches SAWS / weather apps.

## Data sources (primary pick — free forever, no keys)

- **Open-Meteo** — forecast + 80-year historical, rate-unlimited
- **NASA POWER** — daily agromet (solar radiation, ET, GDD) back to 1981
- **CHIRPS** — 30+ year rainfall archive, 5 km resolution over Africa
- **ERA5** (Copernicus) — deep reanalysis, optional
- **NASA GIBS** — weather-satellite tile overlays (cloud, rainfall) for MapLibre

## Sub-specs

| Sub-spec | Scope |
|---|---|
| **8a** | Daily ingestion into `weather_observations` (farm coordinates → multi-provider adapter, backfill, retry) |
| **8b** | Rainfall overlay on MapLibre (daily + cumulative-since-planting) |
| **8c** | Historical explorer — pick variable × date range × farm → chart |
| **8d** | Yield correlation — `field_production.actual_yield_kg` vs growing-season rainfall / heat stress / radiation |
| **8e** | 7-day forecast widget (dashboard panel, frost/storm flags) |
| **8f** | Alerts & thresholds — frost warning, heatwave, cumulative rainfall replant triggers |
| **8g** | **On-farm weather station direct connection** (see note) |

## 🔌 Note for future version: direct weather station connect (spec 8g)

When Alex installs an on-farm station (likely a Davis Vantage Pro2 + Weatherlink Live, ~R15k), spec 8g provides a **direct ingestion adapter** that pulls from the station's API (JSON polling or MQTT stream) and writes into the same `weather_observations` table that 8a uses from public sources.

Key design constraints for 8g:
- Station observations SHOULD take precedence over public-API estimates within, say, 10 km radius of the station.
- A `source` column on `weather_observations` distinguishes `open-meteo | nasa-power | chirps | station-davis | station-generic | ...`.
- Station-level timestamps may be minute-level; aggregate to daily on ingest to keep schema consistent.
- Generic adapter interface so future stations (other brands, home-brew ESP32-based, etc.) plug in by implementing `fetchLatest(config)` and `normalizeObservation(raw)`.

Implementation size estimate: 1–2 days once the station is physically installed and its API is known.

## Integration hooks into existing modules

- **COP (2a/2e):** rainfall deviation annotates each yield row
- **Calendar:** spray tasks auto-check forecast wind + rain before execution
- **Rotation logic:** drought-adjusted replant signal
- **Sheep (2f):** grazing capacity function of 60-day rainfall
- **Dashboard:** weather widget next to price forecast

## Build order

8a → (8c + 8d together) → 8b → 8e → 8f → 8g (when hardware exists)
