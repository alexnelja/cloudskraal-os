# Spec 4 (benched) — Task lifecycle

- **Status:** Scope documented, full brainstorming + plan deferred.
- **Depends on:** Spec 3 (task creation from map) — lifecycle adds value once tasks exist; spec 2a (cost tagging) — completion posts actuals to COP.
- **Blocks:** Calendar coverage view; "what was actually done this season" reports.

## Problem

Tasks today are append-only with a free-text status. No state machine, no audit trail, no posting of actuals. Operator marks a task done, but the planned inputs/duration never reconcile against what was actually used. COP reports lose visibility into per-task cost.

## Scope

### State machine

`scheduled → in_progress → completed → verified` (with `cancelled` as a terminal off-ramp).

Transitions:
- `scheduled → in_progress`: stamp `actual_start`, optional assignee swap.
- `in_progress → completed`: stamp `actual_end`, capture `actual_inputs_json` (often differs from planned), capture `actual_duration_hrs`.
- `completed → verified`: supervisor sign-off; **at this transition** the system writes `inventory_transactions` (one per actual input) + `time_entries` (one per worker × hours) tagged with `task_id`.
- Any state → `cancelled`: write a reason; no postings.

### Tables

- Existing `tasks` extended with: `actual_start`, `actual_end`, `actual_inputs_json`, `actual_duration_hrs`, `state`, `verified_at`, `verified_by`, `cancelled_reason`.
- New `task_events(id, task_id, event_type, at, by, notes, payload_json)` — append-only audit trail. `event_type ∈ {created, started, paused, resumed, completed, verified, cancelled, edited}`.
- `inventory_transactions` and `time_entries` already accept `task_id` (or add column if absent).

### Service

`services/taskLifecycle.js`:
- `transition(db, taskId, toState, payload)` — validates legal transition, writes event, updates task row, posts to COP on `verify`.
- `coverageForCalendar(db, year, opts)` — historical view: every completed/verified task plotted by `actual_end` for calendar heatmap.

### API

- `POST /api/tasks/:id/transition` `{to_state, payload}`
- `GET /api/tasks/:id/events`
- `GET /api/tasks/calendar?year=YYYY&view=coverage|planned`

## Known hard parts

- **Partial completions.** A spray task covers 4 ha of an 8 ha field. Need `actual_area_ha` on the task and pro-rate input postings.
- **Inputs differ from planned.** Operator used 12 L instead of planned 10 L; `actual_inputs_json` is the source of truth for postings, not `task_inputs`.
- **Time split across multiple fields.** One worker, one shift, two fields. Either split the task on creation (preferred) or allow `time_entries` to declare a per-task `field_id_override`.
- **Idempotency on verify.** If verify fires twice (UI double-click), the COP postings must not duplicate. Use `task_events` as the source of truth — refuse to verify if a `verified` event already exists.

## Files touched (anticipated)

- New: `backend/src/db/schema-task-events.js`, `backend/src/services/taskLifecycle.js`, `backend/src/routes/task-lifecycle.js`, integration tests.
- Modified: `tasks` table (lifecycle columns), `inventory_transactions` + `time_entries` (task_id column if absent), frontend task detail view, calendar view component.

## Tests

TDD. Unit tests for transition validity matrix (legal/illegal moves). Integration tests for verify-posting idempotency, partial-area pro-rating, multi-field time split. End-to-end test: create task → transition through states → assert COP report sees the actuals.

## Build order

State columns + events table → transition service + tests → API → frontend lifecycle controls → calendar coverage view.
