# Spec 4 — Wiki ↔ task/annotation bidirectional links (tight)

**Status:** Ready to build.
**Depends on:** specs 5b/5c (annotations), spec 3 (tasks w/ annotation_id).

## Problem

Today tasks live only in `/calendar`, annotations live only on the map, wiki pages live only in `/wiki`. There's no crossover. Operator wants:
- Drop a map note → it appears in a "Map notes" wiki page automatically
- A wiki page (SOP, field guide) can embed a checkable task inline
- Completing a task anywhere updates the state everywhere

## Approach

**Reject markdown-checklist-parsing.** Instead: tasks and annotations are first-class DB entities. Wiki pages reference them via inline tokens:
- `::task:<uuid>::` expands to a checkable task block
- `::annotation:<uuid>::` expands to an annotation card with "View on map" link

One source of truth; every view renders from the same row. Check on wiki → PATCH /tasks/:id → every consumer gets the update.

## Scope (in)

1. `tasks.wiki_page_id` + `annotations.wiki_page_id` (FK, ON DELETE SET NULL)
2. Wiki renderer expands `::task:UUID::` and `::annotation:UUID::` tokens into interactive blocks
3. Map-note pin drop → auto-create or update `map-notes` wiki page with an appended `::annotation:UUID::` token
4. Wiki page → "Linked items" section at the bottom listing all tasks + annotations that reference this page
5. Task block in wiki: click the checkbox → toggle `status` between `pending` and `completed`; broadcasts to all open views

## Scope (out)

- Slash-command UI to insert blocks (`/task`) — 4.2
- Block-level drag-reorder
- Real-time collaboration
- Task dashboard reorganisation
- "Verified" task stage
- Auto-unlink when an embed is deleted from wiki body

## Data model

```sql
ALTER TABLE tasks       ADD COLUMN wiki_page_id TEXT REFERENCES wiki_pages(id) ON DELETE SET NULL;
ALTER TABLE annotations ADD COLUMN wiki_page_id TEXT REFERENCES wiki_pages(id) ON DELETE SET NULL;
CREATE INDEX idx_tasks_wiki_page_id       ON tasks(wiki_page_id);
CREATE INDEX idx_annotations_wiki_page_id ON annotations(wiki_page_id);
```

Idempotent migration.

## API

- `GET /api/tasks?wiki_page_id=<id>` — filter (existing tasks route, add the param)
- `GET /api/annotations?wiki_page_id=<id>` — filter
- `POST/PATCH` on tasks + annotations accept `wiki_page_id` as optional
- `GET /api/wiki/pages/:slug/linked` → `{ tasks, annotations }` for the "Linked items" section
- `POST /api/wiki/map-notes/append` → idempotent helper: creates the `map-notes` page if missing, appends `::annotation:UUID::\n` to its body, links the annotation

## Frontend

### WikiTaskBlock.tsx
Renders a task by id. Looks like a Notion inline task: checkbox + title + optional due chip + priority tag. Click → PATCH status. Missing tasks render a gray stub ("Task unavailable").

### WikiAnnotationBlock.tsx
Category icon + title + type-label + "View on map" button → navigates to `/map?annotation=<id>`. Missing annotations render a gray stub.

### WikiRenderer extension
After the markdown pipeline, scan the rendered HTML for `::task:UUID::` and `::annotation:UUID::` pre-markers, replace each with a `<div data-embed="task" data-id="UUID"></div>` placeholder. Post-render, a `useEffect` finds those placeholders and portals a `<WikiTaskBlock>` / `<WikiAnnotationBlock>` into each.

Simpler alternative (chosen): pre-process the body BEFORE markdown runs. Convert tokens to plain marker tags that survive DOMPurify. Then a React effect replaces them via createRoot, exactly like `AnnotationMarkers` does.

### Map note → wiki sync
Extend the "Drop map note" flow in FarmMapPage:
1. POST the annotation as before
2. POST `/api/wiki/map-notes/append` with the new annotation id
3. Response includes the page slug; user gets a toast "Added to Map Notes" with a link

### LinkedItems section on wiki page
Below the rendered body, a compact two-column panel listing:
- Tasks referencing this page (by `wiki_page_id`)
- Annotations referencing this page (by `wiki_page_id`)

This is separate from embedded blocks — it shows items that link to this page even if they're not embedded inline.

## Tests (TDD)

Backend:
- migration adds columns idempotently
- POST task with wiki_page_id persists; GET filter works; ON DELETE SET NULL on wiki page deletion
- POST annotation with wiki_page_id same
- `/api/wiki/map-notes/append` creates page on first call, appends + links annotation on subsequent calls

Frontend:
- WikiTaskBlock: renders title from provided task; checkbox toggle calls onToggle
- WikiAnnotationBlock: renders icon + title; "View on map" button navigates to `?annotation=<id>`
- Wiki renderer: `::task:xyz::` → placeholder div; `::annotation:xyz::` → placeholder div

## Build order

1. Spec doc + commit
2. Backend migrations (wiki_page_id on tasks + annotations)
3. Backend routes: accept + filter by wiki_page_id; `/wiki/pages/:slug/linked`; `/wiki/map-notes/append`
4. Backend integration tests
5. Frontend: API helpers + types
6. Frontend: WikiTaskBlock + test
7. Frontend: WikiAnnotationBlock + test
8. Frontend: WikiRenderer token substitution + effect-based portal mount
9. Frontend: Map-note drop wired to /wiki/map-notes/append
10. Frontend: LinkedItems section on wiki page
11. Typecheck + build + smoke test
12. Commit

## Completion criteria

- [ ] Backend + frontend tests green
- [ ] Writing `::task:<id>::` inside a wiki page renders an interactive checkbox block
- [ ] Dropping a map note creates/updates the `map-notes` wiki page with an annotation block
- [ ] Navigating to `/wiki/map-notes` shows all dropped map-note pins inline
- [ ] ROADMAP + benched-4 updated
