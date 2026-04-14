# Spec 7 (benched) — Live position tracking: employees & vehicles

- **Status:** Scope documented, full brainstorming + plan deferred.
- **Gated on:** Written consent policy (POPIA compliance) BEFORE any code. Legal review recommended.
- **Scope:** Real-time + historical position data for **both employees (via phone) and vehicles (via GPS hardware)**, rendered on the same map, backed by the same location stream schema.

## Problem

Operator wants to see on the map:
- Which workers are where right now (task assignment, safety)
- Where the bakkies, tractors, spray rigs are moving
- Historical trails (coverage heatmap, productivity analysis)

Currently the map only shows fixed polygons + notes. No moving entities.

## Split into sub-specs

| Sub-spec | Scope |
|---|---|
| **7a** | Device capture — mobile PWA or native wrapper; phone GPS permission, periodic ping (configurable interval), battery-friendly |
| **7b** | Backend location stream + consent/permissions model — `locations(entity_type, entity_id, lat, lng, accuracy_m, recorded_at, source, battery_pct)`; signed consent log |
| **7c** | **Live map layer** — current positions for both employees AND vehicles on the map, auto-refresh every 10-30s, icons differentiated by entity type |
| **7d** | Historical trails + coverage heatmap — replay a day, compute work-zones |
| **7e** | **Vehicle GPS hardware integration (see note)** — receive pings from installed trackers, same `locations` schema |

## 🚗 Note for future version: vehicle GPS integration (spec 7e)

On-vehicle GPS trackers (Teltonika, Geotab, Digital Matter, etc.) push coordinates to their cloud backends and expose the data via **API or webhook**. Spec 7e adds a generic vehicle ingestion adapter:

Design constraints:
- `entity_type='vehicle'` rows in the same `locations` table used by employees — one schema, one map layer
- `vehicles(id, reg_no, make, type, current_field_id, tracker_provider, tracker_device_id, notes)` lookup table
- Per-provider adapters: `adapters/teltonika.js`, `adapters/geotab.js`, etc. Implement `pollOrSubscribe() → LocationPing[]`
- Webhook endpoint at `POST /api/location-ingest/vehicle/:vehicle_id` accepts provider-formatted payloads with a shared signing secret
- Map renders vehicle icons (tractor, bakkie, spray rig) sized by zoom; live position + 30-minute trail

Employee phone capture (7a) and vehicle hardware capture (7e) both write into the same `locations` table; the map layer (7c) renders both in one pass with different icons.

## ⚠️ POPIA/consent note (applies to all of spec 7)

Tracking employees requires:
1. Explicit written consent in employment contract addendum
2. Stated purpose (task routing + safety, NOT surveillance)
3. Retention + deletion policy (e.g. keep raw pings 90 days, aggregate after)
4. Employee right to see their own data and request deletion
5. Off-duty tracking explicitly disabled (geofence farm boundary OR time-window)

Vehicle tracking has looser legal requirements (farm asset) but still needs a policy.

**Do not ship code before the policy doc exists and is signed by every worker who'll be tracked.**

## Integration hooks

- **Tasks / Calendar:** assign task to nearest available worker
- **Field panel:** show who's been on this field today
- **Time entries (existing):** auto-log hours from location dwell time in a field
- **COP labour:** more accurate field attribution for labour cost

## Files touched (anticipated)

New: 3-4 tables, 2-3 services, 4-5 routes, mobile PWA capture path, vehicle webhook path, map layer component.

## Build order

Policy doc → 7b (schema + consent log) → 7a (phone capture, opt-in) → 7c (live map) → 7d (trails) → 7e (vehicle adapters, when trackers are installed)
