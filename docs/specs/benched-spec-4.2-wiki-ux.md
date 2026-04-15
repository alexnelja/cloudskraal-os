# Spec 4.2 (benched) — Wiki/task UX polish

**Status:** Scope documented, deferred after spec 4 (tight) shipped.
**Depends on:** spec 4 (`::task:UUID::` and `::annotation:UUID::` embed tokens).

## What spec 4 shipped

- `wiki_page_id` FKs on tasks + annotations
- Inline embed tokens rendered as interactive blocks
- Map-note → `/wiki/map-notes` auto-sync
- `LinkedItemsPanel` below every wiki page

## What spec 4.2 adds

### 1. Slash-command inserters

In the wiki editor (CodeMirror), typing `/task` or `/annotation` opens a picker:

- `/task` → list of recent + pending tasks; select one → inserts `::task:<id>::\n` at cursor; task's `wiki_page_id` auto-updated to the current page
- `/task new` → opens inline `CreateTaskModal`, on save inserts the new token + links
- `/annotation` → list of recent annotations with category icon; select inserts `::annotation:<id>::\n` + links

Use the existing `WikiSlashMenu` component; extend `SLASH_ITEMS` with dynamic sections.

### 2. Real-time sync across tabs

If the same task is rendered in two tabs (e.g. /calendar and /wiki), checking in one tab should reflect in the other without refresh.

- Option A: polling — each `WikiTaskBlock` re-fetches every 30s
- Option B: BroadcastChannel — `new BroadcastChannel('cloudskraal-tasks')`; PATCH broadcasts; listeners update local state. Zero network cost.

Recommend B.

### 3. Block drag-reorder

Inside a wiki page, embed blocks should be draggable to reorder. The tokens are just text, so this is really about the CodeMirror editor support for block-level drag handles. Deferrable — typing is currently the workflow and that's fine.

### 4. Task-side wiki link

When viewing a task (in `/calendar`, or via a future `/tasks` dashboard), show a link to the wiki page that embeds it. Requires `GET /api/tasks/:id` to hydrate `wiki_page` (JOIN to wiki_pages for the slug + title).

### 5. Annotation-side wiki link

In `AnnotationsSidebar` and `FieldPanel.Enrichment` tab, show "linked to wiki page: Map notes" when present.

### 6. Slash command for inserting a NEW task from inside the wiki

`/task new Title text` → creates task with `wiki_page_id = current`, inserts embed at cursor. Keeps the user in the wiki while the task data lands in the tasks table.

## Out of scope

- Multi-tab real-time using WebSockets (BroadcastChannel is enough for same-browser)
- Full Notion-style drag-drop block editor
- Auto-unlink when a block is removed from wiki body (stale `wiki_page_id` is harmless)

## Build order

1. `/task` + `/annotation` slash commands in WikiSlashMenu (extend SLASH_ITEMS with dynamic fetches)
2. BroadcastChannel in `WikiTaskBlock` for PATCH replay
3. Hydrate `wiki_page` on GET /tasks/:id
4. Task-side + annotation-side wiki link UI
