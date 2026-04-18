# Task Manager UX Research — 2026-04-18

Research compiled from 4 parallel agents studying modern task managers, farm work patterns, SA agri compliance, and emerging tools.

---

## 1. Reward / Dopamine Mechanisms (Best-in-Class)

| Tool | Mechanism | Notes |
|------|-----------|-------|
| Apple Reminders | Haptic tap + strikethrough + fade to "Completed" section | Most durable — physical feedback resists hedonic adaptation |
| Monday.com | Confetti explosion + hand-clap animation on "Done" | Toggleable. Fun but wears off |
| Notion | Smooth fade-out + rollup progress bar fill | Visual cleanliness IS the reward |
| ClickUp | Animated checkmark + goal % fill (red → yellow → green) | Burndown charts for ongoing dopamine |
| Sunsama | Guided shutdown ritual with time-spent vs estimated | Reflection loop — 30% better time estimation within first month |
| Todoist | Karma points, levels (Beginner → Enlightened), streaks | Gamification — good for habit-forming |

**Recommendation:** Haptic + strikethrough + progress bar fill. Confetti as an opt-in Easter egg, not default. The Sunsama shutdown reflection is high-value for farm managers reviewing their day.

---

## 2. Organization Patterns

### Notion: One Database, Many Views
- Define tasks once, render as Board / Table / Timeline / Calendar
- Rollup properties auto-aggregate child status into parent progress bars
- Linked databases show same tasks filtered differently per page

### Monday.com: Color-Coded Status Columns
- Each workflow state gets a bold, user-defined color pill
- Board health readable at a glance by color distribution (faster than reading text)
- Groups within boards act as category buckets

### ClickUp: Inherited Status Workflows
- Workspace > Space > Folder > List > Task > Subtask > Checklist
- Status workflows defined at high level, overridden at lower levels
- One workspace serves teams with very different workflows

### Linear: Keyboard-First + Triage Intelligence
- Every action via keyboard shortcuts (no mouse needed)
- AI auto-suggests labels, priority, assignee based on historical patterns
- Cycles (time-boxed sprints) + Projects (cross-cycle goals)

### Apple Reminders: Natural Language + Smart Lists
- Type "Call vet tomorrow at 3pm" — highlights "tomorrow at 3pm" in blue, one-tap confirm
- Smart lists auto-filter by tag, date, priority, location
- Location-based triggers (remind when arriving at the farm)

### Todoist: Inline Parsing
- `Submit report next Tuesday p1 #Work` — parses date, priority, project in one string
- No dropdowns, no modals — just type

---

## 3. Emerging Tools — Key Innovations

| Tool | Innovation | Status |
|------|------------|--------|
| **Sunsama** | Guided daily planning + shutdown ritual with time tracking feedback | Wirecutter 2025 pick |
| **Amie** | Calendar-task split view — drag unscheduled task onto timeslot to timebox | Active |
| **Reclaim.ai** | Flexible-to-busy calendar blocks — priority-based auto-rescheduling | Active |
| **Linear** | Triage Intelligence — LLM reads task content to auto-categorize | Active |
| **Superlist** | AI meeting-to-task pipeline (records calls, generates tasks with owners) | Active |
| **Plane** | Full open-source project management (Next.js + TS). AGPL-3.0 | 30k+ stars |
| **Height** | Shut down Sep 2025. Lesson: AI should act on task semantics, not just fields | Dead |

---

## 4. Farm Work Taxonomy — 7 Buckets, 3 Timing Types

### Universal Categories (enterprise-agnostic)

| Category | Description | Cloudskraal Examples |
|----------|-------------|---------------------|
| **Crop Operations** | All field/plant work | Rooibos harvest/oxidation, grape spray, lupine planting |
| **Livestock Operations** | Animal husbandry | Sheep dosing, shearing, lambing, camp rotation |
| **Infrastructure & Equipment** | Maintenance, repairs | Fence patrol, pump repair, irrigation servicing |
| **Procurement & Inputs** | Purchasing, stock management | Chemical reorder, seed procurement, fuel |
| **Labour & Administration** | People management | Weekly payroll, seasonal worker intake, training |
| **Compliance & Certification** | Regulatory obligations | GlobalGAP audit, DALRRD inspection, spray records |
| **Financial & Marketing** | Money and market | Monthly COP review, contract delivery window |

### Timing Types

| Type | Description | Examples |
|------|-------------|---------|
| **Seasonal/Calendar** | Tied to growth stage or time of year | Rooibos harvest (Jan-Mar), shearing (Sep-Oct) |
| **Recurring/Periodic** | Fixed intervals | Weekly fence check, monthly equipment service |
| **Triggered/Event-driven** | Fired by a condition | Rain closes spray window, lambing triggers marking |

### Farm Software Hierarchy Pattern
**Plan → Work Order → Field Job → Completion Record**
Work orders attach to: location (field/camp), enterprise (crop/herd), inputs used, responsible person.

---

## 5. SA-Specific Compliance Tasks

| Requirement | Authority | Type | Details |
|------------|-----------|------|---------|
| Chemical spray records | GlobalGAP | Calendar | 2 years minimum. Every PPC application documented |
| Withholding periods (PHI) | Chemical label / CODEX | Triggered | e.g., Delegate insecticide = 2 months before rooibos harvest |
| Re-entry intervals (REI) | OHS Act | Triggered | Workers cannot enter sprayed block for specified hours |
| Water use license | DWS / National Water Act | Annual | Section 21 compliance audits by external auditors |
| Stock theft reporting | SAPS / Act 57 of 1959 | Event-driven | Unknown animals must be reported immediately |
| Export certification | DALRRD / PPECB | Pre-export | Phytosanitary certificates, cold-chain inspection |
| Wine production records | SAWIS | Annual | Origin and production volume documentation |
| Organic certification | Ecocert / SA Rooibos Council | Annual | Right Rooibos standard, EU/JAS/NOP market access |
| Animal identification | Animal ID Act | Ongoing | Brand mark registration, traceability |
| MRL compliance | CODEX / DOH | Per-shipment | Maximum Residue Limits for export rooibos and wine |

---

## 6. Cloudskraal Module Integration — Compound Advantage

### Map + Tasks
- Task like "Scout Block 5A" clickable on map polygon
- Spatial task queue: "which fields need attention this week" as heat map
- Route optimization: sequence field visits to minimize driving

### Usage Periods + Tasks
- Field transition (rooibos → oats rotation) auto-generates task template
- PHI enforcement: blocks scheduling harvest within withholding period of spray
- Enterprise-aware: task inherits the field's current enterprise

### COP + Tasks
- Completed task auto-logs cost (labor hours, chemical inputs, fuel) into per-field COP
- Budget-vs-actual alerts fire when input costs exceed plan mid-season
- Every task completion is a COP data point

### Weather + Tasks
- Wind > 15 km/h flags spray tasks as "weather-blocked"
- Rain probability > 60% within 24h flags harvest as "at risk"
- Frost warnings auto-generate livestock shelter tasks
- **Highest-value integration** — turns static schedule into living plan

### Wiki + Tasks
- Spray task links to wiki article on application rates
- Shearing task links to breed-specific protocol
- Wiki page for "looper worm control" shows all related completed tasks as compliance history

### Calendar + Enterprise Filter
- Rooibos manager sees only rooibos tasks
- Livestock manager sees only sheep tasks
- Seasonal workers get stripped-down view of assigned tasks only

---

## 7. Technical Stack Recommendations

### Drag-and-Drop
- **dnd-kit** — default choice. ~2.8M weekly downloads, 6KB core, excellent a11y
- **Pragmatic Drag-and-Drop** (Atlassian) — better for 1000+ items, file drops

### Open-Source References
- **Plane** (AGPL-3.0) — full project management, Next.js + TS, 30k stars
- **react-kanban-kit** — lightweight composable Kanban with Atlassian DnD
- **Shadcn Kanban** (Jan 2026) — dnd-kit + shadcn/ui, easy to theme

### Sync Protocols
- **CalDAV** (RFC 4791) — open standard for VTODO sync, free servers (Baikal, Nextcloud)

---

## 8. Design Decisions Captured

### Primary Navigation: "Today" View First
- **Why:** Farming is day-driven. Farm managers check "what's on today", then drive to fields.
- **Home screen:** Today's work pulled from all 7 buckets, with mini-map showing field visits
- **Secondary views:** Board (planning), Calendar (long-term), Map (spatial)
- **Pattern source:** Sunsama daily planning ritual + FieldMargin spatial awareness

### Key UX Patterns to Implement
1. Haptic + strikethrough + fade on completion (Apple)
2. Color-coded status pills per enterprise (Monday)
3. Spatial task binding to map polygons (FieldMargin)
4. One database, many views (Notion)
5. Inline natural language date parsing (Apple/Todoist)
6. Progress bar fill on parent items (Notion/Monday)
7. Guided daily shutdown with time reflection (Sunsama)
8. Drag-to-schedule from task list to calendar (Amie)
9. Weather-aware task blocking (novel — no existing tool does this)
10. PHI/REI countdown timers on compliance tasks (novel)

### What Makes This Best-in-Class
No standalone task tool can combine spatial awareness + weather intelligence + cost tracking + compliance record-keeping + knowledge base linking. The compound advantage is the moat.
