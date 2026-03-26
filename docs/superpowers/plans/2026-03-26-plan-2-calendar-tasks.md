# Phase 1, Plan 2: Seasonal Calendar & Task Engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a seasonal calendar with task management supporting 4 task types (scheduled, triggered, dependent, manual), input tracking per task, and pre-loaded Cloudskraal seasonal events across rooibos/sheep/wine enterprises.

**Architecture:** Add calendar_events, tasks, task_inputs, task_checklists tables to existing SQLite schema. Build Express routes for CRUD + task completion + dependency resolution. Frontend: calendar month view with enterprise color-coding, task list/detail views, and a responsive layout (full calendar on desktop, list-first on mobile).

**Tech Stack:** Express, SQLite (better-sqlite3), React 19, TypeScript, Tailwind CSS 4, Recharts (for timeline), Lucide React icons

**Spec:** `docs/superpowers/specs/2026-03-26-cloudskraal-os-design.md` (Section 5.2)

---

## File Structure

### Backend — New Files
| File | Responsibility |
|------|---------------|
| `backend/src/db/schema-calendar.js` | calendar_events, tasks, task_inputs, task_checklists tables |
| `backend/src/db/seed-calendar.js` | Pre-load seasonal events from Notion extract + Elsenburg research |
| `backend/src/routes/calendar.js` | CRUD for events, tasks, task inputs, completion, dependency queries |

### Backend — Modified Files
| File | Change |
|------|--------|
| `backend/src/db/schema.js` | Import and call `initCalendarSchema(db)` |
| `backend/src/index.js` | Import calendar routes + seed |

### Frontend — New Files
| File | Responsibility |
|------|---------------|
| `frontend/src/pages/CalendarPage.tsx` | Calendar page with month view + task list |
| `frontend/src/components/calendar/MonthView.tsx` | Month grid with event/task dots |
| `frontend/src/components/calendar/TaskList.tsx` | Filterable task list with status badges |
| `frontend/src/components/calendar/TaskDetail.tsx` | Task detail panel with inputs, checklist, dependencies |
| `frontend/src/components/calendar/TaskEditor.tsx` | Create/edit task form |
| `frontend/src/components/calendar/EventEditor.tsx` | Create/edit calendar event form |
| `frontend/src/api/calendar.ts` | API client for calendar/task endpoints |
| `frontend/src/types/calendar.ts` | TypeScript types |

### Frontend — Modified Files
| File | Change |
|------|--------|
| `frontend/src/App.tsx` | Replace calendar placeholder with CalendarPage, add /calendar/tasks routes |

---

## Task 1: Backend — Calendar Schema

**Files:**
- Create: `backend/src/db/schema-calendar.js`
- Modify: `backend/src/db/schema.js`

- [ ] **Step 1: Create schema-calendar.js**

```javascript
function initCalendarSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      enterprise TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT,
      all_day INTEGER DEFAULT 1,
      recurrence_rule TEXT,
      color TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      enterprise TEXT,
      field_id TEXT REFERENCES fields(id),
      type TEXT NOT NULL DEFAULT 'manual',
      status TEXT NOT NULL DEFAULT 'pending',
      priority TEXT DEFAULT 'medium',
      due_date TEXT,
      completed_date TEXT,
      completed_by TEXT,
      assigned_to TEXT,
      depends_on_task_id TEXT REFERENCES tasks(id),
      recurrence_rule TEXT,
      calendar_event_id TEXT REFERENCES calendar_events(id),
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_inputs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      product_name TEXT NOT NULL,
      category TEXT,
      rate REAL,
      rate_unit TEXT,
      total_applied REAL,
      total_unit TEXT,
      cost_per_unit REAL,
      total_cost REAL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS task_checklists (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      item TEXT NOT NULL,
      checked INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0
    );
  `);
}

module.exports = { initCalendarSchema };
```

- [ ] **Step 2: Wire into schema.js** — add `require('./schema-calendar')` and call `initCalendarSchema(db)` after `initFarmSchema(db)`

- [ ] **Step 3: Verify** — delete DB, run schema init, confirm 4 new tables exist

- [ ] **Step 4: Commit** — `feat: add calendar_events, tasks, task_inputs, task_checklists schema`

---

## Task 2: Backend — Calendar Seed Data

**Files:**
- Create: `backend/src/db/seed-calendar.js`
- Modify: `backend/src/index.js`

- [ ] **Step 1: Create seed-calendar.js**

Seed pre-loaded seasonal calendar events from the Notion extracts and Elsenburg research. These are recurring annual events across enterprises.

**Rooibos events:**
- Rooibos Nursery Setup (Feb 1 - Mar 31, yearly)
- Start Rooibos Harvest (Jan 6, yearly)
- Harvest at Agterseland (Jan 16, yearly)
- Garsland Factory Occupation (Nov 1, yearly)
- Seed Sowing (Feb 15, yearly)
- Transplanting Window (May 1 - Jul 31, yearly)

**Sheep events:**
- Ramme by die Ooie / Joining (Dec 3, yearly)
- Ram Removal (Dec 20, yearly)
- Lambing Season (May 17 - Jul 31, yearly)
- Shearing (Sep 1 - Oct 31, yearly)
- Quarterly Dosing (every 3 months)

**Wine events:**
- Check Grapes for Harvest (Mar 4, yearly)
- Grape Harvest (Mar 10 - Mar 31, yearly)
- Pruning (Jul 1 - Jul 31, yearly)

**General:**
- Khulani Team Begins (Jan 16, yearly)
- Prepare Soil for Grains (Nov 1 - Dec 18, yearly)
- Grain Sowing (Apr 1, yearly)

Each event gets: id, title, enterprise, start_date (2026 dates), end_date, recurrence_rule: 'YEARLY', color (matching enterprise colors).

Also seed some example tasks:
- "Order rooibos seed" — type: scheduled, due: 2026-01-15, enterprise: rooibos, priority: high
- "Service Bovic cutters pre-harvest" — type: scheduled, due: 2025-12-15, enterprise: rooibos, priority: high
- "Apply lime to B2: Damkamp" — type: manual, enterprise: rooibos, with task_input: Lime, 2 tonnes/ha, 18.1 ha = 36.2 tonnes
- "Shearing preparation" — type: dependent, depends on "Move sheep to shearing shed", enterprise: sheep

- [ ] **Step 2: Wire into index.js** — import and call `seedCalendar(db)` after `seedFarms(db)`

- [ ] **Step 3: Verify** — check event and task counts

- [ ] **Step 4: Commit** — `feat: seed seasonal calendar events and example tasks`

---

## Task 3: Backend — Calendar & Task API Routes

**Files:**
- Create: `backend/src/routes/calendar.js`
- Modify: `backend/src/index.js`

- [ ] **Step 1: Create calendar.js routes**

Endpoints:

```
GET  /api/calendar/events              → CalendarEvent[] (?month=YYYY-MM&enterprise=X)
POST /api/calendar/events              → Create event
PATCH /api/calendar/events/:id         → Update event
DELETE /api/calendar/events/:id        → Delete event

GET  /api/tasks                        → Task[] (?status=X&enterprise=X&field_id=X&due_before=X&due_after=X)
GET  /api/tasks/:id                    → Task with inputs[] and checklists[]
POST /api/tasks                        → Create task
PATCH /api/tasks/:id                   → Update task
DELETE /api/tasks/:id                  → Delete task

POST /api/tasks/:id/complete           → Mark complete (sets completed_date, completed_by, status=completed)
                                         Also: if other tasks depend on this one, check if they become unblocked

POST /api/tasks/:id/inputs             → Add input to task
DELETE /api/task-inputs/:inputId       → Delete input

POST /api/tasks/:id/checklist          → Add checklist item
PATCH /api/task-checklists/:itemId     → Toggle checked
DELETE /api/task-checklists/:itemId    → Delete checklist item

GET  /api/tasks/overdue                → Tasks with due_date < today and status != completed
GET  /api/tasks/upcoming?days=7        → Tasks due in next N days
GET  /api/calendar/summary?month=YYYY-MM → { events: CalendarEvent[], tasks: Task[] } for a month
```

Key implementation:
- GET /api/tasks returns tasks WITHOUT inputs/checklists (list view)
- GET /api/tasks/:id returns full task with inputs[], checklists[], and dependency info (depends_on task title/status)
- POST /api/tasks/:id/complete sets status='completed', completed_date=now. If task has `depends_on_task_id`, check the dependency is completed first (return 400 if not).
- GET /api/calendar/summary returns both events and tasks for a given month, for the calendar view
- All task list endpoints support sorting by due_date

- [ ] **Step 2: Mount in index.js** — `app.use('/api', calendarRoutes)`

- [ ] **Step 3: Test endpoints**

- [ ] **Step 4: Commit** — `feat: calendar events and task management API routes`

---

## Task 4: Frontend — Calendar Types & API Client

**Files:**
- Create: `frontend/src/types/calendar.ts`
- Create: `frontend/src/api/calendar.ts`

- [ ] **Step 1: Create calendar types**

```typescript
export interface CalendarEvent {
  id: string;
  title: string;
  enterprise: string | null;
  start_date: string;
  end_date: string | null;
  all_day: boolean;
  recurrence_rule: string | null;
  color: string | null;
  notes: string | null;
}

export type TaskType = 'scheduled' | 'triggered' | 'dependent' | 'manual';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'overdue';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  enterprise: string | null;
  field_id: string | null;
  field_name?: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  completed_date: string | null;
  completed_by: string | null;
  assigned_to: string | null;
  depends_on_task_id: string | null;
  depends_on_task?: { id: string; title: string; status: string } | null;
  recurrence_rule: string | null;
  calendar_event_id: string | null;
  notes: string | null;
  inputs?: TaskInput[];
  checklists?: TaskChecklist[];
}

export interface TaskInput {
  id: string;
  task_id: string;
  product_name: string;
  category: string | null;
  rate: number | null;
  rate_unit: string | null;
  total_applied: number | null;
  total_unit: string | null;
  cost_per_unit: number | null;
  total_cost: number | null;
  notes: string | null;
}

export interface TaskChecklist {
  id: string;
  task_id: string;
  item: string;
  checked: boolean;
  sort_order: number;
}

export interface CalendarSummary {
  events: CalendarEvent[];
  tasks: Task[];
}
```

- [ ] **Step 2: Create calendar API client** with functions for all endpoints

- [ ] **Step 3: Verify TypeScript compiles**

- [ ] **Step 4: Commit** — `feat: calendar types and API client`

---

## Task 5: Frontend — Calendar Month View

**Files:**
- Create: `frontend/src/components/calendar/MonthView.tsx`
- Create: `frontend/src/pages/CalendarPage.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create MonthView component**

A month grid calendar that shows:
- 7-column grid (Mon-Sun), 5-6 rows for weeks
- Each day cell shows colored dots for events and tasks on that day
- Dot colors match enterprise (ENTERPRISE_COLORS)
- Today highlighted with ring/bg
- Click a day → show events/tasks for that day in a detail panel
- Navigation: previous/next month arrows + month/year display
- Enterprise filter chips at top (same as map)

Props:
```typescript
interface MonthViewProps {
  year: number;
  month: number; // 1-12
  events: CalendarEvent[];
  tasks: Task[];
  onDayClick: (date: string) => void; // YYYY-MM-DD
  onPrevMonth: () => void;
  onNextMonth: () => void;
  selectedDate: string | null;
}
```

Desktop: full grid with event titles visible in cells.
Mobile: compact grid with dots only, selected day expands below.

- [ ] **Step 2: Create CalendarPage**

Main page combining MonthView + task list sidebar:
- Fetch calendar summary for current month on mount
- State: currentYear, currentMonth, selectedDate, enterpriseFilter
- Desktop layout: MonthView (left, 60%) + day detail/task list (right, 40%)
- Mobile layout: MonthView (top) + selected day detail (bottom, scrollable)
- Enterprise filter bar at top

- [ ] **Step 3: Update App.tsx** — replace calendar placeholder with CalendarPage, add `/calendar/tasks` route

- [ ] **Step 4: Commit** — `feat: calendar month view with enterprise-colored events`

---

## Task 6: Frontend — Task List & Detail

**Files:**
- Create: `frontend/src/components/calendar/TaskList.tsx`
- Create: `frontend/src/components/calendar/TaskDetail.tsx`
- Modify: `frontend/src/pages/CalendarPage.tsx`

- [ ] **Step 1: Create TaskList component**

A filterable list of tasks. Props: `tasks: Task[], onSelect: (taskId) => void, selectedId: string | null`

Each task row shows:
- Priority indicator (colored left border: red=urgent, amber=high, blue=medium, gray=low)
- Title
- Enterprise badge (colored pill)
- Due date (with relative text: "today", "tomorrow", "overdue 3d")
- Status badge (pending=gray, in_progress=blue, completed=green, overdue=red)
- Task type icon (scheduled=clock, triggered=zap, dependent=link, manual=hand)

Filters at top: status dropdown, enterprise dropdown
Sort: by due_date (default), by priority, by enterprise

- [ ] **Step 2: Create TaskDetail component**

Slide-in panel (same pattern as FieldPanel — sidebar on desktop, bottom sheet on mobile).

Shows full task details:
- Title, description
- Status with action buttons (Start → Complete)
- Priority, type, enterprise badges
- Due date
- Assigned to
- Linked field (clickable → navigates to map)
- **Dependency**: if depends_on_task_id is set, show "Blocked by: [task title]" with status. If dependency not completed, show lock icon and disable Complete button.
- **Inputs section**: table of inputs (product, rate, total applied, cost)
- **Checklist**: checkable items with add button
- **Notes**: text area
- Edit/Delete buttons

- [ ] **Step 3: Integrate into CalendarPage**

When a task is selected (from task list or day click), show TaskDetail panel.

- [ ] **Step 4: Commit** — `feat: task list with filters and task detail panel`

---

## Task 7: Frontend — Task & Event Editors

**Files:**
- Create: `frontend/src/components/calendar/TaskEditor.tsx`
- Create: `frontend/src/components/calendar/EventEditor.tsx`
- Modify: `frontend/src/pages/CalendarPage.tsx`

- [ ] **Step 1: Create TaskEditor**

Modal form for creating/editing tasks. Fields:
- Title (required)
- Description (textarea)
- Type: dropdown (manual, scheduled, triggered, dependent)
- Enterprise: dropdown
- Field: dropdown (searchable, from fields list)
- Priority: dropdown (low, medium, high, urgent)
- Due date: date input
- Assigned to: text input
- Depends on: task search/dropdown (only shown if type=dependent)
- Recurrence: dropdown (none, daily, weekly, monthly, yearly)
- Notes: textarea

"Add Input" button at bottom opens inline input row:
- Product name, category dropdown, rate, rate unit, total applied, total unit

"Add Checklist Item" button adds text input rows.

- [ ] **Step 2: Create EventEditor**

Simpler modal for calendar events:
- Title, enterprise, start date, end date, all day toggle, recurrence, color, notes

- [ ] **Step 3: Wire editors into CalendarPage**

- "New Task" button → opens TaskEditor modal
- "New Event" button → opens EventEditor modal
- Edit button on TaskDetail → opens TaskEditor with pre-filled data
- On save → POST/PATCH API, refresh data

- [ ] **Step 4: Commit** — `feat: task and event editor modals`

---

## Task 8: Dashboard Integration

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Add upcoming tasks section to Dashboard**

Add a new section to the Dashboard (the operational command center) between the tier summary and recent projects:

**"Upcoming Tasks" panel:**
- Fetch `/api/tasks/upcoming?days=7`
- Show next 7 days of tasks, grouped by day
- Each task: title, enterprise badge, priority indicator, due date
- "Overdue" tasks highlighted in red at top
- Click task → navigate to /calendar/tasks with that task selected
- "View Calendar" link at bottom

This transforms the dashboard from a capex-only view into the operational command center.

- [ ] **Step 2: Add overdue count to metric cards**

Add a 5th metric card: "Tasks Due" showing count of overdue + upcoming 7 days. Red if any overdue.

- [ ] **Step 3: Commit** — `feat: dashboard upcoming tasks and overdue alerts`

---

## Summary

| Task | What it builds | Key files |
|------|---------------|-----------|
| 1 | Calendar/task database schema | `schema-calendar.js` |
| 2 | Seasonal events + example tasks seed | `seed-calendar.js` |
| 3 | REST API for events, tasks, inputs, checklists | `routes/calendar.js` |
| 4 | TypeScript types + API client | `calendar.ts` types + API |
| 5 | Calendar month view page | `MonthView.tsx`, `CalendarPage.tsx` |
| 6 | Task list + detail panel | `TaskList.tsx`, `TaskDetail.tsx` |
| 7 | Task + event editor modals | `TaskEditor.tsx`, `EventEditor.tsx` |
| 8 | Dashboard integration | `Dashboard.tsx` updated |
