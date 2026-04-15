# Spec 3.2 (benched) — Task templates + cost pre-fill

**Status:** Scope documented, deferred after spec 3 (tight) shipped.
**Depends on:** spec 3, `input_products` catalogue, `field_usage_period`.

## Why it matters

Spec 3 (tight) made it one-click to create a *blank* task for a field or pin. The original benched spec 3 went further: the task modal would pre-fill suggested operations based on the field's current usage, auto-scale inputs to area, compute cost, and suggest an assignee from prior similar tasks. That's what this bench spec tracks.

## Scope

### New table

```sql
CREATE TABLE task_templates (
  id              TEXT PRIMARY KEY,
  usage           TEXT NOT NULL,         -- matches field_usage_period.usage
  op_type         TEXT NOT NULL,         -- spray, harvest, prune, plant, fertilize, disc…
  name            TEXT NOT NULL,         -- "Roundup spray" / "Stokke harvest"
  default_inputs_json TEXT,              -- [{product, rate_per_ha, unit}]
  default_duration_hrs REAL,
  default_unit_rate REAL,                -- R per ha or per hour
  notes           TEXT,
  sort_order      INTEGER DEFAULT 0
);
```

Seed: 5–10 templates per usage; grow from operator feedback.

### UX

Right-click a field → context menu shows **usage-filtered op suggestions** (rooibos field → harvest, prune, spray; lupines → plant, spray, harvest; fallow → disc, fertilize). Click an op → `CreateTaskModal` pre-fills:

- Title = template name
- Default inputs with quantities scaled to `field.area_ha`
- Estimated cost = Σ (qty × `input_products.unit_cost`)
- Suggested duration
- Suggested assignee = last person who did this op on this field (extend `tasks` query)
- Editable due date, priority

### Service

`services/taskSuggestions.js`:
- `suggestionsForField(db, fieldId)` → active usage → matching templates + recent assignee
- `estimateCost(db, templateId, areaHa)` → scaled cost

### API

- `GET /api/fields/:id/task-suggestions` → list of suggestion cards
- Existing `POST /api/tasks` extended with optional `template_id` to record provenance

On task creation, freeze the cost estimate into `tasks.estimated_cost_zar` (new column) so it doesn't drift when input prices change.

### Assignee ranking (nice to have)

v2: "most-frequent assignee on this field for this op in last 12 months" — for v1, just use "last assignee".

## Known hard parts

- Curating the seed template library — needs domain input (what ops per usage).
- Multi-field tasks deferred.
- Cost freezing: snapshot on create, not auto-update.

## Files touched (anticipated)

- Backend: `schema-task-templates.js`, `seed-task-templates.js`, `services/taskSuggestions.js`, `routes/task-suggestions.js`, integration test
- Frontend: context menu gains suggestion tiles; `CreateTaskModal` gains "template" prop; cost preview tile
- Modified: `tasks` table extension for `template_id` + `estimated_cost_zar`

## Build order

Schema + seed → service + API + tests → context menu suggestion tiles → modal template pre-fill → cost display.

## Completion criteria

- [ ] Right-click rooibos field shows harvest/prune/spray suggestions
- [ ] Clicking a suggestion opens modal pre-filled with inputs + cost for field area
- [ ] Cost snapshotted on create
- [ ] Template library seeded for rooibos, lupines, fallow, grazing to start
