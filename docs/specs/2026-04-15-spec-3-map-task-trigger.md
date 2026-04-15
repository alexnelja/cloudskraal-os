# Spec 3 — Map → task trigger (tight scope)

- **Status:** Ready to build. This is a re-scoped version of the benched spec — the full usage-filtered template system is deferred to 3.2.
- **Depends on:** existing `tasks` table + `/api/tasks` routes (already built, used by `/calendar`); spec 5b `annotations` table.
- **Unblocks:** Spec 4 (task lifecycle + wiki↔task linking).

## Problem

Operator on the map sees a field or a pin (pump, gate, trough) that needs work — e.g., "service this pump", "repair the east fence". Today, creating that task means leaving the map, going to `/calendar`, filling out the full form from scratch, and manually retyping the field or infrastructure it belongs to. We want one right-click → task in five seconds.

## Scope (in)

- Right-click on a field polygon **or** an annotation marker → context menu → "Create task…"
- `CreateTaskModal`: title (prefilled from source name), due date, priority (low/medium/high), notes
- Auto-fills `field_id` (from field right-click) or `annotation_id` (from marker right-click)
- Saves via existing `POST /api/tasks`
- Tasks badge in sidebar showing count per annotation
- `GET /api/tasks?annotation_id=<id>` filter for loading linked tasks
- `DELETE` and `PATCH` on tasks unchanged (use existing endpoints)

## Scope (out)

- Usage-filtered task templates (`task_templates` table from original benched spec 3) — defer to 3.2
- Automatic cost estimate pre-fill from `input_products` × area — defer
- Recurrence rules, task_checklists pre-population — defer
- Assignee auto-suggestion from prior tasks — defer
- Multi-field tasks — defer

## Data model

`ALTER TABLE tasks ADD COLUMN annotation_id TEXT REFERENCES annotations(id) ON DELETE SET NULL;`
`CREATE INDEX idx_tasks_annotation_id ON tasks(annotation_id);`

Idempotent migration (check via `PRAGMA table_info`).

## API

All new shape handled on existing endpoints:

- `POST /api/tasks` body gains optional `annotation_id: string`.
- `GET /api/tasks` query accepts `?annotation_id=<id>`.
- `GET /api/tasks/:id` response hydrates `annotation_id`.

## Frontend

- **`CreateTaskModal.tsx`** (new): compact form: title (required), due date (date input, optional), priority (select: low/medium/high), notes (textarea). Save/Cancel.
- **`FieldContextMenu.tsx`** (new, reusable for future menu items): positioned absolutely based on mouse event; closes on outside click; single item for now ("Create task…"). Anchored as an absolutely positioned `<ul>` near the pointer.
- **FarmMap**:
  - On `contextmenu` event over `fields-fill`: prevent default, emit coord + field_id via new prop `onFieldContextMenu`.
  - AnnotationMarkers: `oncontextmenu` on each marker `el` → emit annotation_id.
- **FarmMapPage**:
  - State: `contextMenu: { type: 'field' | 'annotation'; sourceId: string; x: number; y: number; sourceTitle: string } | null`
  - Renders `FieldContextMenu` when set
  - On "Create task…" click: opens `CreateTaskModal` with prefilled title
- **Sidebar row** for each annotation: renders `Tasks (N)` badge fetched alongside the annotation list (extend `/api/annotations` or make a second small batch call).

For sidebar counts, simplest approach: single `GET /api/tasks?open=true` on map load → group client-side by `annotation_id`. Fewer endpoints.

## Tests

**Backend:**
- `tasks-annotation-link.test.js` (integration, extending existing tasks-api setup if any — otherwise stand-alone):
  - POST with `annotation_id` persists and returns the field
  - GET `?annotation_id=<id>` returns only linked tasks
  - Deleting the annotation sets the task's `annotation_id` to null (ON DELETE SET NULL)

**Frontend:**
- `CreateTaskModal.test.tsx`: renders title/due/priority/notes; Save disabled without title; Save submits expected payload; Cancel calls `onCancel`
- `FieldContextMenu.test.tsx`: renders at given coords; "Create task…" click fires `onCreateTask`; Escape / outside click closes

## Known hard parts

- **Long-press on touch devices** — deferred. Context menu is keyboard+mouse only in v1.
- **Context menu positioning** near edges — fixed viewport-relative positioning; if the menu would overflow, we flip.
- **Stale counts** — after creating/deleting a task, refresh the tasks list. For v1, after every mutation re-fetch the small tasks-by-annotation map.
- **Annotation marker `contextmenu` bubbling** — ensure the event doesn't also fire on the map canvas below (stopPropagation in the marker handler).

## Files touched

**New backend:**
- `backend/src/db/migrate-tasks-annotation-link.js`
- `backend/tests/tasks-annotation-link.test.js`

**Modified backend:**
- `backend/src/db/schema.js` — register migration
- `backend/src/routes/calendar.js` — POST + GET accept `annotation_id`

**New frontend:**
- `frontend/src/components/map/CreateTaskModal.tsx` + test
- `frontend/src/components/map/FieldContextMenu.tsx` + test
- `frontend/src/api/tasks.ts` — typed API client (just what we need: list + create + delete)
- `frontend/src/types/task.ts`

**Modified frontend:**
- `FarmMap.tsx` — contextmenu handlers
- `AnnotationMarkers.tsx` — contextmenu on marker el, emits annotation_id
- `FarmMapPage.tsx` — state + modal wiring + tasks fetch
- `AnnotationsSidebar.tsx` — tasks count badge

## Build order (TDD)

1. Spec doc + commit
2. Backend migration + wire into schema
3. Backend route extensions + tests
4. Frontend api/tasks.ts + types
5. CreateTaskModal (test → impl)
6. FieldContextMenu (test → impl)
7. FarmMap contextmenu handlers
8. AnnotationMarkers contextmenu
9. FarmMapPage state + fetch + render
10. Sidebar count badge
11. Typecheck + build + smoke test
12. Commit

## Completion criteria

- [ ] Right-click a field → menu → Create task → saves, appears in `/calendar`
- [ ] Right-click a pin marker → same
- [ ] Sidebar shows task count per annotation
- [ ] Backend + frontend tests all green
- [ ] Typecheck + build clean
- [ ] Benched-3 + ROADMAP updated
