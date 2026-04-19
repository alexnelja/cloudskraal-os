# Design Spec: Task Manager Phase 3 — Module Integrations

**Date:** 2026-04-18
**Status:** Draft
**Author:** Alex + Claude
**Depends on:** Phase 1 (schema, routes, types) + Phase 2 (views, NLP input, board, list)

---

## 1. Purpose

Connect the Task Manager to existing Cloudskraal modules (Weather, Map, COP, Usage Periods) and add PWA capabilities (GPS detection, push notifications). These integrations are what make this a farm task manager rather than generic Trello — the compound advantage.

---

## 2. Weather-Aware Task Blocking

### 2.1 Data Source

Open-Meteo API — already called from the frontend (`WeatherForecastPanel`). Returns wind speed (km/h), precipitation (mm), temperature (°C), and weather codes. Cached in localStorage for 3 hours. No API key required.

### 2.2 Blocking Logic

A new service function `evaluateWeatherBlocks(tasks, weather)` checks each task's tags against weather conditions:

| Tag | Condition | Block Reason |
|-----|-----------|-------------|
| `Crop Ops` or tasks with "spray" in title | Wind > 15 km/h | `weather_wind` |
| `Crop Ops` or tasks with "harvest" in title | Rain probability > 60% within 24h | `weather_rain` (warning only, not hard block) |
| `Livestock Ops` | Frost warning (temp < 2°C) | `weather_frost` (warning, auto-generates shelter task if template exists) |
| Any outdoor task | Temperature > 38°C | `weather_heat` (warning badge) |

### 2.3 When It Runs

- **On Tasks page load:** fetch weather (or use cached), evaluate blocks, update task states
- **Manual refresh:** small "refresh weather" button in the Today view header
- Blocked tasks get `blocked_reason` and `blocked_until` set via PATCH
- When weather clears (next check), blocked tasks auto-unblock

### 2.4 UI

- Blocked tasks show inline weather widget: "Wind 22 km/h — blocked until tomorrow 6am (forecast: 8 km/h)"
- Warning tasks show an amber badge (not blocked, just flagged)
- Weather summary strip at top of Today view: current conditions + any blocks active

### 2.5 Implementation

**Frontend only** — no backend weather service needed. The frontend already fetches Open-Meteo data. The blocking evaluation runs client-side. Results are persisted via PATCH to `blocked_reason`/`blocked_until` on the task.

```typescript
// frontend/src/lib/weatherBlocking.ts
export interface WeatherData {
  wind_speed_max: number;    // km/h
  precipitation_sum: number;  // mm
  temperature_min: number;    // °C
  temperature_max: number;    // °C
}

export interface WeatherBlock {
  taskId: string;
  reason: 'weather_wind' | 'weather_rain' | 'weather_frost' | 'weather_heat';
  severity: 'blocked' | 'warning';
  message: string;
  clearsAt: string | null;  // ISO timestamp from forecast
}

export function evaluateWeatherBlocks(
  tasks: Task[],
  today: WeatherData,
  forecast: WeatherData[],  // next 7 days
): WeatherBlock[]
```

---

## 3. Map Integration — Collapsible Strip

### 3.1 Layout

A collapsible map strip (~150px tall) above the Today view task list:

```
+--------------------------------------------------+
| Quick Input Bar                                  |
+--------------------------------------------------+
| [Collapse ▲] Mini Map Strip (150px)              |
|  ● ● ●  dots on field polygons = pending tasks   |
+--------------------------------------------------+
| Tag filter pills                                 |
+--------------------------------------------------+
| Task list...                                     |
```

### 3.2 Map Content

- Renders the farm's field polygons (reuse existing GeoJSON from FarmMap)
- Dots on fields with pending tasks for today:
  - Red dot = overdue tasks
  - Amber dot = due today
  - Gray dot = no tasks today
- Dot size proportional to task count (min 8px, max 16px)
- Click a field dot → filter the task list below to that field's tasks
- Collapse/expand toggle persisted in localStorage

### 3.3 Implementation

- New component: `frontend/src/components/tasks/TaskMiniMap.tsx`
- Reuses `maplibre-gl` (already installed) with a simplified style (no basemap switcher, no annotations)
- Receives: `geojson` (field polygons), `tasks` (for dot overlay), `onFieldSelect` callback
- On mobile: starts collapsed, expand button shows

### 3.4 Data Flow

The TaskManagerPage already fetches fields. It needs to also fetch field GeoJSON. Check if there's an existing API for farm GeoJSON — likely `GET /api/farms/:id/geojson` or similar from the Map module.

---

## 4. COP Auto-Logging

### 4.1 Flow

When a task with product inputs is marked "Completed":
1. Frontend calls `completeTask(id)`
2. Backend marks task completed
3. Backend checks if task has `task_inputs` records
4. For each input with `total_cost > 0`, create a COP transaction record:
   - `field_id` from the task
   - `category` from the input's category
   - `product_name`, `total_cost`, `date` = completion date
   - `source` = 'task' (to distinguish from manual COP entries)
   - `task_id` = the originating task (for audit trail)
5. Return the task with a `costs_logged` count in the response

### 4.2 Backend Changes

In `backend/src/routes/calendar.js`, the `POST /tasks/:id/complete` handler:

```javascript
// After marking task completed, auto-log COP
const inputs = db.prepare('SELECT * FROM task_inputs WHERE task_id = ?').all(id);
const costsLogged = [];
for (const input of inputs) {
  if (input.total_cost && input.total_cost > 0 && task.field_id) {
    const txnId = uuidv4();
    db.prepare(`
      INSERT INTO field_input_transactions 
      (id, field_id, product_name, category, total_cost, date, type, source, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'input', 'task', ?, ?, ?)
    `).run(
      txnId, task.field_id, input.product_name, input.category || 'other',
      input.total_cost, now, `Auto-logged from task: ${task.title}`, now, now
    );
    costsLogged.push(txnId);
  }
}
```

### 4.3 Undo Support

The response includes `costs_logged: string[]` (transaction IDs). The frontend shows a toast: "3 costs logged to COP" with an "Undo" link. Undo calls `DELETE /api/field-input-transactions/:id` for each logged transaction.

Check if this delete endpoint exists — if not, add it.

### 4.4 Frontend

- After `completeTask()` returns, check `costs_logged` in response
- If > 0, show toast with undo (5-second auto-dismiss)
- Toast component: reuse existing toast pattern or create a simple one

---

## 5. Usage Period Transition Triggers

### 5.1 Concept

When a field's usage period changes (e.g., rooibos year 3 → oats rotation), the system offers to generate tasks from the relevant template.

### 5.2 Implementation

This is a **check on Tasks page load**, not a real-time event:

```typescript
// frontend/src/lib/usagePeriodTriggers.ts
export function checkTransitionTriggers(
  fields: Field[],
  usagePeriods: UsagePeriod[],
  existingTasks: Task[],
  templates: TaskTemplate[],
): TransitionSuggestion[]
```

Compare each field's current usage period against:
- Does a template exist for this enterprise transition?
- Have tasks already been generated for this transition? (check for tasks with matching field_id + template metadata)
- If template exists and tasks haven't been generated → suggest

### 5.3 UI

A notification banner in the Today view: "Block 5A transitioned to Oats — generate planting tasks?" with "Generate" and "Dismiss" buttons.

### 5.4 PHI/REI Enforcement

When creating a harvest task for a field:
- Check the field's recent spray history (task_inputs with chemical products)
- If a spray was applied within the product's PHI window, show a warning: "Block 5A was sprayed with Delegate on Apr 10 — PHI clears Apr 10 + 60 days = Jun 9"
- Block harvest task creation before PHI expires (or allow with explicit override)

PHI data: stored as metadata on the product input (or a simple lookup table). For MVP, hardcode common rooibos chemicals:
- Delegate: 60 days
- Chlorpyrifos: 21 days

### 5.5 Backend

No new routes needed — the frontend does the checking client-side using existing data (fields, usage periods, tasks, templates).

---

## 6. GPS Field Detection

### 6.1 Implementation

Using the Geolocation API + Turf.js `booleanPointInPolygon` (already installed).

```typescript
// frontend/src/hooks/useFieldDetection.ts
export function useFieldDetection(
  geojson: GeoJSON.FeatureCollection | null,
  enabled: boolean,
): { fieldId: string | null; fieldName: string | null }
```

- Uses `navigator.geolocation.watchPosition` with `{ enableHighAccuracy: false }` (saves battery)
- Debounced to check every 30 seconds max
- Only active when app is foregrounded (`document.visibilityState === 'visible'`)
- Tests user position against field polygons using Turf.js
- Returns the detected field ID and name, or null

### 6.2 UI — Passive Banner

When a field is detected, show a banner at the top of the Today view:

```
┌──────────────────────────────────────────────┐
│ 📍 You're in Block 5A — 3 tasks  [Show →]   │
└──────────────────────────────────────────────┘
```

- Tapping "Show" filters the task list to that field
- Banner auto-dismisses if user navigates away or leaves the field
- First use: permission prompt ("Allow location access for field detection?")

### 6.3 Opt-In

- Controlled via a toggle in the task manager settings (default: off)
- Only prompts for geolocation when user enables the toggle
- Permission state persisted in localStorage

---

## 7. Push Notifications

### 7.1 Events

| Event | Trigger | Message |
|-------|---------|---------|
| Task assigned | PATCH task with `assigned_to` set | "New task: {title}" |
| Overdue reminder | Morning cron (8am) | "You have {n} overdue tasks" |
| Weather block lifted | Weather check finds previously blocked task is now clear | "Wind dropped — spray window open for {field}" |
| PHI complete | Date check finds PHI countdown expired | "Harvest cleared for {field} — {chemical} PHI complete" |

### 7.2 Implementation

Push notifications require:
1. **Service worker** (already implemented in `public/sw.js`)
2. **Push subscription** via the Push API
3. **Backend push sender** to dispatch notifications

For MVP, use **local notifications via the Notification API** (no backend push server needed):
- The frontend's weather/PHI checks run on page load
- If a block was lifted since last check, show a browser notification
- Overdue reminder: check on page load if today's date has overdue tasks

This avoids the complexity of a push server (VAPID keys, subscription management) for Phase 3. A full push server can be added in Phase 4.

### 7.3 Permission Flow

- First time: "Enable notifications for weather alerts and task reminders?" prompt
- Uses `Notification.requestPermission()`
- Permission state persisted — don't re-prompt if denied

---

## 8. Technical Approach

### New Files

| File | Purpose |
|------|---------|
| `frontend/src/lib/weatherBlocking.ts` | Weather evaluation logic (pure function) |
| `frontend/src/lib/weatherBlocking.test.ts` | Tests for blocking rules |
| `frontend/src/hooks/useFieldDetection.ts` | GPS field detection hook |
| `frontend/src/hooks/useFieldDetection.test.ts` | Tests for detection |
| `frontend/src/components/tasks/TaskMiniMap.tsx` | Collapsible map strip |
| `frontend/src/components/tasks/TaskMiniMap.test.tsx` | Map strip tests |
| `frontend/src/components/tasks/WeatherStrip.tsx` | Weather summary + blocked status |
| `frontend/src/components/tasks/WeatherStrip.test.tsx` | Weather strip tests |
| `frontend/src/components/tasks/FieldBanner.tsx` | GPS "You're in X" banner |
| `frontend/src/components/tasks/CopToast.tsx` | COP auto-log toast with undo |
| `frontend/src/lib/usagePeriodTriggers.ts` | Transition detection logic |
| `frontend/src/lib/notifications.ts` | Browser notification helpers |

### Modified Files

| File | Change |
|------|--------|
| `backend/src/routes/calendar.js` | COP auto-logging in complete handler |
| `frontend/src/pages/TaskManagerPage.tsx` | Wire weather, map, GPS, notifications |
| `frontend/src/components/tasks/TodayView.tsx` | Add WeatherStrip, FieldBanner, MiniMap |

### No New Dependencies

Everything needed is already installed:
- `maplibre-gl` (map rendering)
- `@turf/boolean-point-in-polygon` (GPS detection)
- `@turf/centroid` (field center for dots)
- `motion/react` (animations)

---

## 9. Implementation Phases

### Task 1: Weather Blocking Service
- `weatherBlocking.ts` pure function + tests
- `WeatherStrip.tsx` component showing conditions + blocks
- Wire into TodayView

### Task 2: Map Mini-Strip
- `TaskMiniMap.tsx` with field dots
- Collapsible, click-to-filter
- Wire into TodayView above task list

### Task 3: COP Auto-Logging
- Backend: auto-log in complete handler
- Frontend: CopToast with undo
- Delete endpoint if needed

### Task 4: Usage Period Triggers
- `usagePeriodTriggers.ts` detection logic + tests
- Transition banner in TodayView
- PHI enforcement on harvest task creation

### Task 5: GPS Field Detection
- `useFieldDetection.ts` hook + tests
- `FieldBanner.tsx` passive banner
- Settings toggle for opt-in

### Task 6: Browser Notifications
- `notifications.ts` helper
- Permission flow
- Weather unblock + overdue triggers

### Task 7: Verification
- Full test suite
- Manual smoke test
- Handoff document

---

## 10. Success Criteria

- Spray tasks auto-block when wind > 15 km/h with clear "blocked until" message
- Mini-map shows field task density at a glance, click filters the list
- Completing a task with inputs auto-logs costs to COP with zero manual entry
- Usage period transitions suggest task generation from templates
- GPS detects which field you're in and surfaces relevant tasks
- Browser notifications fire for weather unblocks and overdue tasks
- All integrations work offline-first (degrade gracefully when offline)
