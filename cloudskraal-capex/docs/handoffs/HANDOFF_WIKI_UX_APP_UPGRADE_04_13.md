# Handoff: Cloudskraal Wiki Obsidian-Style Build + App-Wide UX Upgrade

**Created:** 2026-04-13
**Branch:** main (all changes uncommitted)
**Session Duration:** ~6 hours across 2 days

---

## Summary

Built a full Obsidian-inspired wiki system for Cloudskraal from scratch — CodeMirror 6 live preview editor with widget decorations, file tree with drag-drop and right-click context menus, 40+ wiki features. Then cleaned technical debt (split files, removed dead code, consolidated CSS) and added data safety (soft delete, audit trail, API tests). Next session: app-wide UX upgrade, dashboard overhaul, and global keyboard shortcuts.

---

## Work Completed

### Wiki Features (38 total)

- [x] CodeMirror 6 editor with Obsidian-style live preview (formatting hidden on non-cursor lines)
- [x] Widget decorations: wiki links, highlights, checkboxes, images
- [x] Cmd+Click and regular click navigation on wiki link widgets
- [x] Link hover preview tooltips
- [x] `/` slash commands (23 commands: text, blocks, inline, templates)
- [x] `[[` autocomplete with page search + create-new option
- [x] Code syntax highlighting in editor
- [x] Auto-save on blur + Cmd+S
- [x] Left sidebar file tree (Obsidian-style folders by category)
- [x] Right-click context menu (Rename, Duplicate, Move to, Pin, Copy Link, Delete)
- [x] Drag files between folders with Apple HIG-style animations
- [x] Keyboard navigation in file tree (Arrow keys + Enter)
- [x] Inline filter for file tree (real-time title filter)
- [x] Category filter via clickable breadcrumb
- [x] Cmd+K command palette
- [x] Right sidebar (all collapsible sections, start collapsed)
- [x] Properties panel (date, category, enterprise, editable tags, editable aliases, stats)
- [x] Table of Contents (scroll-synced with IntersectionObserver)
- [x] Mini graph (d3-force in sidebar)
- [x] Full graph view (dark theme, floating controls, adjustable force/distance/size sliders)
- [x] Backlinks with paragraph context
- [x] Broken link indicators (red dashed style)
- [x] Unlinked mentions detection (batched regex, cached)
- [x] Tag cloud in sidebar
- [x] Visual line-by-line diff in version history
- [x] Page version history with revisions on every edit
- [x] Page templates (5 types via slash commands)
- [x] Daily notes with auto-create
- [x] Page aliases (backend + editable UI)
- [x] `==highlight==` syntax, footnotes, mermaid diagrams
- [x] Collapsible/foldable headings
- [x] Interactive checkboxes (click to toggle, auto-save)
- [x] FTS5 full-text search with ranked results and snippets
- [x] Scroll position memory (sessionStorage)
- [x] Mobile bottom sheet for sidebar content
- [x] Page cache for instant navigation
- [x] Smooth transitions (wiki-fade-in, wiki-scale-in, wiki-slide-in)
- [x] DOMPurify XSS sanitization

### Technical Debt Cleared

- [x] Split WikiPage.tsx: 659 → 284 lines (extracted WikiSinglePage, SidebarSection)
- [x] Deleted 4 unused files (WikiInlineEditor, WikiLiveEditor, WikiEditor, WikiLinkAutocomplete)
- [x] Consolidated wiki CSS: all styles in `wiki.css` (85 lines) + `cm-widgets.ts` theme
- [x] Fixed infinite render loop (brokenSlugs Set created every render → useMemo)
- [x] Fixed page navigation stuck (Route structure + key={slug})
- [x] Fixed scroll jump while typing (removed onChange feedback loop)
- [x] Fixed XSS vulnerability (DOMPurify + html:false in MarkdownIt)
- [x] Fixed stale closure in saveBody (useCallback + cache read)
- [x] Added regex safety limits (500 char capture, 1000 iteration cap)

### Data Safety

- [x] Soft delete → wiki_trash table (30-day retention)
- [x] Audit trail → wiki_audit_log (create/update/delete/restore actions)
- [x] Trash restore endpoint
- [x] 13 API tests passing (vitest)

---

## Files Affected

### Created (17 files)

- `frontend/src/components/wiki/WikiCMEditor.tsx` — CodeMirror 6 editor component
- `frontend/src/components/wiki/cm-widgets.ts` — Widget decorations + live preview plugin
- `frontend/src/components/wiki/WikiSinglePage.tsx` — Page view (extracted from WikiPage)
- `frontend/src/components/wiki/SidebarSection.tsx` — Reusable collapsible section
- `frontend/src/components/wiki/WikiFileTree.tsx` — Folder tree with drag/drop/context menu
- `frontend/src/components/wiki/WikiCommandPalette.tsx` — Cmd+K palette
- `frontend/src/components/wiki/WikiSlashMenu.tsx` — / slash commands
- `frontend/src/components/wiki/WikiLinkMenu.tsx` — [[ autocomplete dropdown
- `frontend/src/components/wiki/WikiLinkPreview.tsx` — Hover popover
- `frontend/src/components/wiki/WikiTableOfContents.tsx` — Scroll-synced ToC
- `frontend/src/components/wiki/WikiMiniGraph.tsx` — d3-force local graph
- `frontend/src/components/wiki/WikiProperties.tsx` — Editable metadata panel
- `frontend/src/components/wiki/WikiHistory.tsx` — Visual diff history
- `frontend/src/components/wiki/WikiTagCloud.tsx` — Tag browser
- `frontend/src/components/wiki/WikiBottomSheet.tsx` — Mobile sidebar sheet
- `frontend/src/wiki.css` — All wiki CSS consolidated
- `backend/tests/wiki-api.test.js` — 13 API endpoint tests

### Modified (key files)

- `frontend/src/pages/WikiPage.tsx` — Rewritten as thin layout/router (284 lines)
- `frontend/src/App.tsx` — Changed wiki routes to `/wiki/*` wildcard
- `frontend/src/index.css` — Stripped wiki CSS, imports wiki.css
- `frontend/src/api/wiki.ts` — Added history, daily notes, reorder, create APIs
- `frontend/src/types/wiki.ts` — Added broken_links, unlinked_mentions, aliases, snippet fields
- `backend/src/routes/wiki.js` — Added: history, daily notes, reorder, trash, audit, FTS5, backlink context
- `backend/src/services/wiki-links.js` — Added: broken links, unlinked mentions (batched), title cache
- `backend/src/db/schema-wiki.js` — Added: wiki_revisions, wiki_trash, wiki_audit_log, wiki_fts, sort_order, aliases columns
- `frontend/src/components/wiki/WikiGraph.tsx` — Added forceStrength/linkDistance/nodeScale props
- `frontend/src/components/wiki/WikiRenderer.tsx` — Added DOMPurify, footnotes, mermaid, heading IDs, fold toggles, link hover

### Deleted

- `frontend/src/components/wiki/WikiInlineEditor.tsx` — Superseded by WikiCMEditor
- `frontend/src/components/wiki/WikiLiveEditor.tsx` — Superseded by WikiCMEditor
- `frontend/src/components/wiki/WikiEditor.tsx` — Modal replaced by direct page creation
- `frontend/src/components/wiki/WikiLinkAutocomplete.tsx` — Superseded by WikiLinkMenu

---

## Technical Context

### New Dependencies (frontend)

- `@codemirror/state`, `@codemirror/view`, `@codemirror/lang-markdown`, `@codemirror/language`, `@codemirror/language-data`, `@codemirror/commands`, `@codemirror/search`, `@codemirror/autocomplete`, `@lezer/highlight` — CodeMirror 6
- `dompurify`, `@types/dompurify` — XSS sanitization
- `markdown-it-footnote` — Footnote support
- `mermaid` — Diagram rendering (dynamic import)

### New Dependencies (backend)

- `vitest` (devDependency) — Test runner

### Architecture Notes

- Wiki uses a single `/wiki/*` route with slug parsed from `location.pathname`
- `key={slug}` on WikiSinglePage forces clean remount on navigation
- Page cache (`Map<string, WikiPage>`) provides instant navigation, refreshes in background
- CodeMirror 6 ViewPlugin (`livePreviewPlugin`) handles all widget decorations
- Formatting hidden via `Decoration.mark({ class: 'cm-formatting-hidden' })` on non-cursor lines
- Wiki links use `Decoration.replace({ widget: new WikiLinkWidget() })` on non-cursor lines
- Block-level widgets (callouts, tables) are NOT implemented — CM6 multi-line replace causes reconciler crashes

---

## Known Issues

1. **Block-level widgets** — Callouts (`> [!note]`) and tables show as raw markdown in CM editor. Multi-line `Decoration.replace` crashes CM6's `coordsAtPos`. Needs StateField approach or line-by-line decoration.
2. **`coordsAtPos` warnings** — Non-fatal errors in headless Playwright tests when CM6 computes coords before DOM layout. Doesn't affect actual app.
3. **Mermaid in editor** — Renders only in WikiRenderer (read-only preview), not in CM editor.
4. **Graph view** — Settings sliders exist but graph doesn't re-render when values change (need to pass as useEffect dependencies in WikiGraph).

---

## Next Steps (User's Request)

### Immediate: App-Wide UX Upgrade

The user wants to bring all 12 other pages (Dashboard, Equipment, Livestock, etc.) up to the wiki's polish level:

1. **Consistent layout pattern** — Each page should match the wiki's 3-panel layout where appropriate
2. **Inline editing everywhere** — Click-to-edit cells like the wiki's inline title
3. **Smooth transitions** — Add wiki-fade-in, wiki-scale-in to all page loads
4. **Better empty states** — Consistent "no data" patterns
5. **Mobile responsiveness** — Test and fix all pages for mobile

### Then: Dashboard Overhaul

- Split Dashboard.tsx (606 lines) into components
- Better data visualization
- Quick actions
- Recent activity feed

### Then: Global Features

- **Cmd+K for whole app** — Search across all modules (pages, fields, equipment, tasks)
- **Keyboard shortcuts** — Navigate between modules, common actions
- **Notifications** — Activity feed, mentions
- **Data export** — CSV/PDF from any module

---

## Commands to Run

```bash
# Start both servers
cd /Users/alexnelja/projects/cloudskraal-capex/backend && npm run dev
cd /Users/alexnelja/projects/cloudskraal-capex/frontend && npm run dev

# Run wiki API tests
cd /Users/alexnelja/projects/cloudskraal-capex/backend && npx vitest run tests/wiki-api.test.js

# TypeScript check (from frontend dir)
cd /Users/alexnelja/projects/cloudskraal-capex/frontend && npx tsc -b

# App URLs
# Frontend: http://localhost:5173
# Backend: http://localhost:3001
# Wiki: http://localhost:5173/wiki
```

### Search Queries

- `grep -r "WikiSinglePage" src/` — Find wiki page view usage
- `grep -r "useParams" src/pages/` — Find pages using URL params
- `wc -l src/pages/*.tsx | sort -rn` — Page sizes for splitting priority

---

## Open Questions

- [ ] Should the app-wide Cmd+K search use the same FTS5 approach across all modules?
- [ ] Should inline editing be extracted as a shared component from the wiki's pattern?
- [ ] Should the 3-panel layout (sidebar + content + right panel) become the standard for all pages?
- [ ] Graph settings: should WikiGraph re-create simulation when props change, or update forces in-place?

---

## Spec Documents

- `docs/specs/2026-04-13-cloudskraal-wiki-multiplatform.md` — Full spec for multiplatform (iPhone, Mac desktop, web) with auth, RBAC, offline sync. Marked as future implementation.
- `docs/plans/2026-04-12-wiki-obsidian-tier1.md` — Original Tier 1 implementation plan

---

_This handoff was generated at context window capacity. All changes are uncommitted on main branch. Start a new session and commit first._
