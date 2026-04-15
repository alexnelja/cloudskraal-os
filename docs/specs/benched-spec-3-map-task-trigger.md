# Spec 3 (SHIPPED) — Map → task trigger

**Status**: shipped as the tight scope. See `2026-04-15-spec-3-map-task-trigger.md` for the shipped spec; the template-driven full scope (op library + cost estimate) is deferred as 3.2.



- **Status:** Scope documented, full brainstorming + plan deferred.
- **Depends on:** Spec #1 (`field_usage_period`) for active-usage lookup; spec 2a/2b for cost estimates from input prices.
- **Blocks:** Spec 4 (task lifecycle) — task creation must exist before lifecycle state machine adds value.

## Problem

Operator sees a field on the map and wants to schedule "spray Roundup" or "harvest stokke" without leaving the map. Today, task creation lives in a separate UI with no field context — operator manually re-types field name, looks up usage, guesses inputs. Inefficient and error-prone.

## Scope

### UX
Right-click a field polygon on `FarmMap` → context menu showing **op suggestions filtered by the field's active usage** (rooibos field → harvest, prune, spray; lupines field → plant, spray, harvest; fallow → disc, fertilize). Click an op → modal pre-fills:
- Field, usage, area (ha)
- Default inputs (with quantities scaled to area)
- Estimated cost (sum of `qty × input_products.unit_cost`)
- Suggested duration, suggested assignee (last person who did this op on this field)
- Editable due date

### Tables

- `task_templates(id, usage, op_type, name, default_inputs_json, default_duration_hrs, default_unit_rate, notes)` — seeded library of usage→op suggestions.
- Existing `tasks` and `task_inputs` tables used for actual creation.

### Service

`services/taskSuggestions.js`:
- `suggestionsForField(db, fieldId)` → looks up active `field_usage_period`, filters `task_templates` by `usage`, joins to recent assignee history.
- `estimateCost(db, templateId, areaHa)` → multiplies `default_inputs_json` × area × current `input_products.unit_cost`.

### API

- `GET /api/fields/:id/task-suggestions` → list of suggestion cards (template + cost + last assignee).
- Existing `POST /api/tasks` extended with optional `template_id` to record provenance.

## Known hard parts

- **Usage-specific op library.** Curating the seed templates needs domain input — what ops apply to rooibos vs lupines vs fallow vs grazing. Start small (5–10 per usage) and grow from feedback.
- **Cost estimate freshness.** Input prices change. Cost estimate must reflect today's `unit_cost`, but once the task is created, the snapshot should freeze (write resolved cost into `tasks.estimated_cost_zar`).
- **Assignee suggestion ranking.** Last-assignee is naive; better is "most-frequent assignee on this field for this op in last 12 months." Defer the smart ranking.
- **Multi-field tasks.** Right-click is single-field; multi-select for one task is a stretch goal.

## Files touched (anticipated)

- New: `backend/src/db/schema-task-templates.js`, `backend/src/db/seed-task-templates.js`, `backend/src/services/taskSuggestions.js`, `backend/src/routes/task-suggestions.js`, integration test.
- Modified: `frontend/src/components/map/FarmMap.tsx` (right-click handler), new `FieldContextMenu.tsx` + `TaskSuggestionModal.tsx`, `tasks` table extension for `template_id` + `estimated_cost_zar`.

## Tests

TDD. Unit tests for `estimateCost` (area scaling, missing prices, default fallback). Integration tests for `/api/fields/:id/task-suggestions` filtering by active usage. Frontend test for context menu rendering for known usage.

## Build order

Templates schema + seed → service + API + tests → context menu UI → suggestion modal → cost estimate display.
