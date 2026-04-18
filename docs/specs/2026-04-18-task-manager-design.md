# Design Spec: Task Manager Module

**Date:** 2026-04-18
**Status:** Draft
**Author:** Alex + Claude

---

## 1. Purpose

A standalone task management module for Cloudskraal CapEx that serves as the daily operational hub for farm managers. Unlike the existing Calendar (which becomes the long-term planning view), the Task Manager owns the daily workflow — what needs doing today, what's blocked, what's been completed.

The module must be:
- **Farm-aware** — tasks bind to fields, enterprises, weather, compliance requirements
- **Configurable** — work categories, statuses, and workflows are variables, not hardcoded
- **Rewarding** — subtle daily completion feedback, meaningful milestone celebrations
- **Mobile-first** — PWA-enhanced for in-field use with GPS, offline, and push notifications

---

## 2. Navigation & Views

### 2.1 App-Level Navigation

New top-level route: `/tasks` added to the sidebar alongside Map, Calendar, Financials, Wiki.

The Tasks page contains three sub-views, switchable via tabs:

| View | Purpose | Primary User |
|------|---------|-------------|
| **Today** | Daily work queue — morning planning, real-time execution | Farm manager in the field |
| **Board** | Kanban columns by status — planning and triage | Farm manager at desk |
| **List** | Filterable table — bulk operations, search, export | Admin / bookkeeper |

The **Today** view is the default landing tab. Optionally configurable as the app-wide default page (instead of Map) via user preferences.

### 2.2 Today View Layout

```
+--------------------------------------------------+
| Quick Input Bar (Reminders-style NLP)            |
+--------------------------------------------------+
| [Enterprise filters]  [Category filters]  [Date] |
+----------------------------+---------------------+
|                            |                     |
|  Task List                 |  Mini-Map           |
|  - Grouped by time/bucket  |  - Today's fields   |
|  - Drag to reorder         |  - Task density dots |
|  - Swipe to complete       |  - Tap to filter     |
|  - Progress bars           |                     |
|                            +---------------------+
|                            |  Weather Summary    |
|                            |  - Wind / Rain risk |
|                            |  - Blocked tasks    |
+----------------------------+---------------------+
| Daily Progress Bar                               |
+--------------------------------------------------+
```

Mobile: stacks vertically — input bar, filters, task list (full width), mini-map collapses to a floating button that opens a sheet.

### 2.3 Board View

Kanban columns driven by the farm's configured statuses. Default columns:

`Todo → In Progress → Blocked → Completed → Verified`

- Drag-and-drop between columns (dnd-kit)
- Cards show: title, enterprise color dot, due date, priority badge, field name
- Swimlanes optional: group by enterprise, category, or assignee
- Column WIP limits configurable

### 2.4 List View

Sortable/filterable table with columns:
- Title, Status, Priority, Enterprise, Category, Field, Due Date, Assignee, Created
- Bulk actions: change status, assign, delete, export CSV
- Quick inline editing (click cell to edit)

---

## 3. Data Model

### 3.1 Tags (Flat, Configurable)

Tags replace the fixed enterprise/category hierarchy. A task can have any combination of tags.

```
tags table:
  id          UUID PK
  farm_id     UUID FK
  name        TEXT NOT NULL
  color       TEXT (hex)
  group       TEXT ('enterprise' | 'category' | 'custom')
  sort_order  INTEGER
  created_at  TIMESTAMP
```

**Default tags seeded per farm:**

Enterprise group: `rooibos, wine, sheep, fallow` (from farm's enterprises)
Category group: `crop-ops, livestock-ops, infrastructure, procurement, labour, compliance, financial`

Farms can add/rename/remove/recolor tags. The `group` field is advisory — all tags are functionally identical.

### 3.2 Custom Statuses

```
task_statuses table:
  id          UUID PK
  farm_id     UUID FK
  name        TEXT NOT NULL
  color       TEXT (hex)
  category    TEXT ('active' | 'done' | 'closed')  -- for rollups/progress
  sort_order  INTEGER
  is_default  BOOLEAN
```

**Default statuses seeded:**

| Name | Color | Category |
|------|-------|----------|
| Todo | `#9ca3af` (gray) | active |
| In Progress | `#3b82f6` (blue) | active |
| Blocked | `#ef4444` (red) | active |
| Completed | `#22c55e` (green) | done |
| Skipped | `#a1a1aa` (zinc) | closed |
| Verified | `#8b5cf6` (purple) | done |

The `category` field drives progress calculation: `done / (active + done)`. `closed` items are excluded.

### 3.3 Task Model (Extended)

### 3.3a Tag Junction Table (Normalized)

Tags are linked via a proper junction table, not JSON:

```
task_tags table:
  id        UUID PK
  task_id   UUID FK REFERENCES tasks(id) ON DELETE CASCADE
  tag_id    UUID FK REFERENCES tags(id) ON DELETE CASCADE
  UNIQUE(task_id, tag_id)
```

This enables efficient filtering (`JOIN task_tags WHERE tag_id = ?`), bulk updates, and tag cardinality stats.

### 3.3b Task Model Extensions

Extends the existing `tasks` table with:

```sql
ALTER TABLE tasks ADD COLUMN status_id UUID REFERENCES task_statuses(id);
ALTER TABLE tasks ADD COLUMN estimated_minutes INTEGER;
ALTER TABLE tasks ADD COLUMN actual_minutes INTEGER;
ALTER TABLE tasks ADD COLUMN blocked_reason TEXT;  -- 'weather_wind' | 'weather_rain' | 'phi_active' | 'custom'
ALTER TABLE tasks ADD COLUMN blocked_until TIMESTAMP;
ALTER TABLE tasks ADD COLUMN sort_order INTEGER;  -- within a day/view
ALTER TABLE tasks ADD COLUMN completed_at TIMESTAMP;
ALTER TABLE tasks ADD COLUMN verified_by TEXT;
ALTER TABLE tasks ADD COLUMN verified_at TIMESTAMP;
```

Existing fields retained: `title, description, enterprise, field_id, annotation_id, wiki_page_id, type, priority, due_date, assigned_to, depends_on_task_id, recurrence_rule, notes, created_at, updated_at`

The `status` text field migrates to `status_id` FK via a safe three-phase migration (see §9).

**Multi-farm isolation:** All new tables include `farm_id`. The current app is single-farm (Cloudskraal) — `farm_id` defaults to the single farm's UUID. This ensures data isolation is ready when the app supports multiple farms without a future migration.

### 3.4 Task Templates

```
task_templates table:
  id          UUID PK
  farm_id     UUID FK
  name        TEXT NOT NULL
  description TEXT
  tags        TEXT (JSON array of tag IDs)
  priority    TEXT
  estimated_minutes INTEGER
  checklist_items TEXT (JSON array of strings)
  input_defaults  TEXT (JSON — default product inputs)
  recurrence_rule TEXT
  created_at  TIMESTAMP
```

Templates are triggered manually ("Create from template") or automatically by usage period transitions.

---

## 4. Task Creation UX

### 4.1 Quick Input Bar (Primary — 80% of task creation)

Persistent input bar at the top of the Today view. Reminders-style natural language parsing:

**Typing:** `Spray Block 5A tomorrow p1 #rooibos #crop-ops`

**Parsed inline (highlighted in blue as detected):**
- `tomorrow` → due date (blue highlight, tap to adjust)
- `p1` → priority high (orange badge)
- `#rooibos` → tag match (colored pill)
- `#crop-ops` → tag match (colored pill)
- `Block 5A` → field name fuzzy match (underlined, tap to confirm)

**Submit:** Enter key or tap arrow button. Task created instantly with parsed metadata.

**Tag autocomplete:** typing `#` shows a dropdown of existing tags, filtered as you type.

### 4.2 Expanded Form (Secondary — 20% of task creation)

Triggered by `...` button on the input bar, or when creating from map context menu / field panel.

Full form fields:
- Title, Description
- Status (dropdown from farm's custom statuses)
- Priority (low / medium / high / urgent)
- Tags (multi-select with color pills)
- Field (searchable dropdown with mini-map preview)
- Due date + time
- Assignee
- Estimated duration
- Template (populate from template)
- Checklist items
- Product inputs (chemical, seed, fertilizer with rate/cost)
- Wiki link
- Recurrence rule
- Dependency (depends on task)
- Annotation link

### 4.3 Context-Aware Creation

Tasks can be created from multiple entry points:
- Quick input bar (Today view)
- Map context menu (right-click field → pre-fills field + enterprise tags)
- Field panel → Tasks tab → "+" button
- Annotation sidebar → linked task creation
- Wiki page → inline task embed
- Calendar → click date → pre-fills due date

---

## 5. Reward System

### 5.1 Daily Subtle (Every Completion)

- `navigator.vibrate(15)` haptic pulse (already implemented)
- Strikethrough animation + item fades to "Completed" section
- Daily progress bar at bottom of Today view fills smoothly
- Task count updates: "12 of 18 done"

### 5.2 Milestone Celebrations (Contextual)

| Milestone | Reward |
|-----------|--------|
| All tasks for a **field** completed | Field polygon pulses green on map for 2s |
| All tasks for an **enterprise** completed today | Enterprise pill glows with success ring |
| Daily **100% completion** | Progress bar fills with golden gradient + "All done" message |
| **Compliance task** verified | Certificate-style confirmation card with timestamp |
| **Season-end** summary | Full-page report: tasks completed, time logged, costs tracked, fields serviced |

### 5.3 Stats (Passive Gamification)

Available in a collapsible "Stats" section (not forced):
- Completion rate this week (%)
- Average tasks/day
- Time estimated vs actual (Sunsama-style feedback loop)
- Streak: consecutive days with 100% completion
- Enterprise breakdown (pie chart)

---

## 6. Module Integrations

### 6.1 Weather + Tasks (Highest Value)

The weather service checks conditions against task requirements:

| Condition | Effect |
|-----------|--------|
| Wind > 15 km/h | Spray tasks auto-set to `blocked`, reason: `weather_wind` |
| Rain probability > 60% within 24h | Harvest tasks flagged "at risk" (warning badge, not blocked) |
| Frost warning | Auto-generates livestock shelter task if template exists |
| Temperature > 35°C | Flags outdoor labour tasks with heat warning |

Blocked tasks show a weather widget inline: "Wind 22 km/h — blocked until tomorrow 6am (forecast: 8 km/h)"

### 6.2 Map + Tasks (Spatial Awareness)

- Today view mini-map shows dots on fields with pending tasks (color = priority)
- Tap a field on mini-map → filters task list to that field
- Full map view: field polygons colored by task status (green = all done, amber = in progress, red = overdue)
- GPS detection (Geolocation API): when standing in a field, auto-surface that field's tasks
- Route optimization: "Plan my route" suggests field visit order to minimize driving

### 6.3 COP + Tasks (Cost Tracking)

- Task completion with product inputs auto-logs to COP
- `actual_minutes` on completion feeds into labour cost calculation
- Budget-vs-actual alert: if field input costs > 110% of budget, task list shows warning
- COP report links back to individual task completion records

### 6.4 Usage Periods + Tasks (Enterprise Intelligence)

- Field transition triggers: when usage period changes (e.g., rooibos → oats), system offers to generate tasks from the relevant template
- PHI enforcement: if field was sprayed with a product that has a withholding period, system blocks harvest task creation within that window and shows countdown
- REI enforcement: blocks worker entry tasks within re-entry interval

### 6.5 Wiki + Tasks (Knowledge Context)

- Tasks can link to a wiki page (existing)
- Wiki pages show all linked tasks as a history/audit trail (existing)
- Task detail panel shows a "Related Knowledge" section pulling from wiki search

### 6.6 Calendar + Tasks (Long-Term View)

- Calendar page shows tasks as dots/bars on date cells (existing)
- Calendar becomes the seasonal planning view — drag tasks to reschedule
- Amie-style: drag unscheduled task from sidebar onto a calendar date

---

## 7. Mobile PWA Experience

### 7.1 Core Mobile Patterns

- **Bottom nav** on mobile: Today / Board / Map / More
- **Swipe right** on task to complete (strikethrough + haptic)
- **Swipe left** on task to snooze / reschedule
- **Pull-to-refresh** syncs with server
- **Floating "+" button** opens quick input bar

### 7.2 GPS Field Detection

Using Geolocation API + Turf.js `booleanPointInPolygon`:
- On location change, test user position against field polygons
- If inside a field, show "You're in Block 5A" banner with that field's tasks
- Opt-in (permission prompt), battery-conscious (watch position only when app is foregrounded)

### 7.3 Push Notifications

Via Push API + service worker:
- Overdue task reminders
- Weather block lifted ("Wind dropped — spray window open")
- Task assigned to you
- PHI countdown complete ("Harvest cleared for Block 5A")

### 7.4 Offline

Already implemented (service worker + sync queue):
- Read tasks from API cache when offline
- Create/update tasks queued in localStorage
- Sync on reconnect with conflict resolution (server wins, user notified)

---

## 8. Technical Stack

| Component | Technology |
|-----------|-----------|
| Drag-and-drop | dnd-kit (6KB, a11y-first) |
| Kanban board | Custom build with dnd-kit + Tailwind |
| Date parsing | chrono-node (NLP date parser) |
| Tag input | Custom with autocomplete |
| Animations | motion/react (already in project) |
| Icons | @phosphor-icons/react (already in project) |
| Spatial queries | @turf/boolean-point-in-polygon (already in project) |
| Push notifications | Web Push API + service worker |
| State management | React state + URL params (existing pattern) |

### 8.1 New Dependencies

- `chrono-node` — natural language date parsing (lightweight, well-maintained)
- `dnd-kit` — drag-and-drop primitives

### 8.2 No New Dependencies Needed

- motion/react (animations — already installed)
- @turf/* (spatial — already installed)
- @phosphor-icons/react (icons — already installed)

---

## 9. Migration Path

### Phase 1: Foundation (Data Model + Basic UI)
- Add `tags`, `task_tags`, `task_statuses`, `task_templates` tables
- Three-phase status migration (safe, non-breaking):
  1. Add `status_id` column (nullable) — existing code unaffected
  2. Seed default `task_statuses`, backfill `status_id` from existing `status` text
  3. Drop old `status` column only after deploy success window
- Seed default tags and statuses
- New `/tasks` page with Today view (basic task list, grouped by time)
- Simple task creation form (expanded form, no NLP yet)
- Update frontend types to support dynamic statuses

### Phase 2: Views & Interactions
- Quick input bar with NLP parsing (chrono-node)
- Board view with dnd-kit Kanban
- List view with filters and bulk actions
- Drag-to-reorder in Today view
- Completion rewards (haptic + strikethrough + progress bar)
- Tag management UI (add/rename/recolor/delete)

### Phase 3: Integrations
- Weather-aware blocking
- Map mini-view in Today + spatial task overlay on full map
- COP auto-logging on completion
- Usage period transition triggers
- GPS field detection

### Phase 4: Polish & Mobile
- Milestone celebrations
- Push notifications
- Daily shutdown ritual (optional)
- Stats dashboard
- Swipe gestures on mobile
- Visual mockup iteration for final UI

---

## 10. Configurability for Other Farms

All farm-specific data is stored in configuration tables, not code:

| What | Where | Default |
|------|-------|---------|
| Work categories | `tags` table, group='category' | 7 universal buckets |
| Enterprises | `tags` table, group='enterprise' | From farm's enterprise list |
| Custom tags | `tags` table, group='custom' | None |
| Status workflow | `task_statuses` table | 6 defaults (todo→verified) |
| Task templates | `task_templates` table | Seeded per enterprise type |
| Weather thresholds | `farm_settings` table | Wind 15km/h, rain 60%, frost 0°C |
| PHI/REI durations | Product metadata (per chemical) | From label registration |

A new farm onboarding flow:
1. Import field polygons (map)
2. Set enterprises
3. Auto-generate tags from enterprises
4. Choose or customize status workflow
5. Load relevant task templates
6. Start working

---

## 11. Success Criteria

- Farm manager can plan their day in < 2 minutes using the Today view
- Quick task creation < 5 seconds via input bar
- 100% of compliance tasks have audit trail (verified status + timestamp)
- Weather blocks prevent scheduling errors before they happen
- Task completion auto-feeds COP with zero manual entry
- Works offline in remote paddocks with sync on reconnect
- Other farms can onboard with their own enterprises/categories/statuses
