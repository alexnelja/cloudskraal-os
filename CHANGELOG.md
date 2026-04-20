# Changelog

All notable changes to Cloudskraal CapEx are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/). Versioning follows [Semantic Versioning](https://semver.org/).

---

## [0.9.0] — 2026-04-20

### Added
- **Task Manager Module** — standalone `/tasks` page with Today/Board/List views
  - Smart list cards home (Apple Reminders pattern)
  - NLP quick input bar with chrono-node date parsing
  - Kanban board with dnd-kit drag-and-drop
  - Sortable/filterable list view with bulk actions
  - Inline task creation at bottom of list
  - Task detail slide-in sheet
  - Custom tags (flat, configurable per farm)
  - Custom statuses (configurable workflow per farm)
  - Tag & status management UI
  - Milestone celebrations (golden 100% bar, stats dashboard)
  - Drag-to-reorder in Today view
- **Weather-aware task blocking** — Open-Meteo integration, auto-blocks spray tasks on wind >15km/h
- **COP auto-logging** — task completion with inputs auto-logs costs with undo toast
- **GPS field detection** — passive banner "You're in Block 5A" with task filter
- **Usage period transition triggers** — suggests task generation on field enterprise change
- **PHI enforcement** — withholding period warnings for harvest scheduling
- **Browser notifications** — overdue, weather unblock, PHI complete
- **Collapsible mini-map** in task Today view with field task density dots
- **Enterprise filter bar** — toggle pills above map view
- **Boundary snapping** — snap-to-vertex/line when drawing adjacent polygons
- **Post-save annotation editing** — load saved annotations into TerraDraw via addFeatures
- **Multiselect + batch delete** for annotations sidebar
- **Searchable category picker** for pin annotations (18 items)
- **Offline support** — service worker, sync queue, online/offline indicator
- **Haptic feedback** on long-press and 44px touch targets
- **Native view transitions** for fluid page animations
- **Hyperframes** setup for future demo video rendering

### Changed
- Task Manager UI redesigned to Apple Reminders pattern (smart list cards, clean rows, inline add)
- QuickAddFAB "New Task" opens inline create prompt with toast (no page navigation)
- Calendar page becomes long-term planning view (tasks own daily workflow)

### Fixed
- Backend: PATCH /fields/:id rejects enterprise writes (read-only, derived from usage periods)
- Backend: Annotation geometry type mismatch returns correct error
- Frontend: CopToast useRef type error
- Frontend: TaskCreateForm useMemo→useEffect for side effects
- Today view filters out completed tasks by default

---

## [0.8.0] — 2026-04-17 (pre-audit baseline)

### Added
- Wiki ↔ task/annotation bidirectional links
- Fluid glass design system
- Live GIS layers + field enrichment
- Map annotations with categories
- Calendar with enterprise filtering
- Cost of Production with denominators & shrinkage
- Field usage periods
- Weather forecast panel

---

## [Unreleased] — v1.0.0 Targets

### Security (from audit S-C1 through S-M5)
- Rotate all secrets, move .env file
- Add authentication middleware (Bearer token or Supabase JWT)
- Fix Mermaid securityLevel to 'strict'
- Sanitize WikiLinkPreview + cm-widgets HTML
- Migrate xlsx → exceljs
- Add rate limiting (express-rate-limit)
- Add input validation (Zod)

### Architecture (from audit A-1 through A-11)
- Extract FarmMapPage into custom hooks (<100 line orchestrator)
- Extract TaskManagerPage into custom hooks
- Centralize error handling middleware
- Split calendar.js routes (events vs tasks)
- Add frontend API caching layer
- Remove unused @supabase/supabase-js dependency

### Database (from audit DB-1 through DB-13)
- Add schema_migrations version table
- Add missing indexes (fields, inventory_transactions, time_entries, financial_transactions)
- Batch refreshFieldCurrent to eliminate N+1
- Add busy_timeout + synchronous pragmas
- Normalize production_batches.source_field_ids

### UX (from audit UX-1 through UX-O5)
- Add Tasks to mobile bottom nav
- Fix TaskDetailSheet tag save
- Fix tag filter navigation
- Add undo on all task completions
- Reorder TaskDetailSheet fields for mobile
- GPS onboarding hint
- Map → Task shortcut in FieldPanel
- Enterprise color dots on task rows
- Hours/days input for estimated duration

### UI (from audit UI-1 through UI-P4)
- Unify icon library (Phosphor only)
- Fix global CSS input override
- Unify accent color (single CTA color)
- Fix ListView design language
- Add click-outside dismiss to popovers
- Smart list card counts in accent color
- Add labels/tooltips to InlineTaskAdd toolbar
- Fix 9px badge text to 10px minimum
- Dark mode support
- Shared components: skeleton loaders, unified toast, empty-state illustrations
- Consistent spacing system
