# Cloudskraal OS — Frontend

Vite + React 19 + TypeScript frontend for Cloudskraal OS, a full farm management system for the Cloudskraal enterprises (Dohne Merino, wine, rooibos, lupines/oats rotation). Deployed to Vercel; talks to the Render-hosted API at `cloudskraal-api.onrender.com`. Styled with Tailwind CSS v4. Includes map (MapLibre GL), charts (Recharts), tables (TanStack Table), an Obsidian-style wiki, a three-statement financial model, and Notion-style inline editing across modules.

## Status

Deployed to Vercel. Active development. Routes (from `src/App.tsx`):

- `/` — Dashboard (clickable charts, project popups)
- `/map`, `/map/:fieldId` — Farm map with field panels and layer controls
- `/calendar`, `/calendar/tasks`, `/calendar/tasks/:taskId` — Task + event calendar
- `/wiki`, `/wiki/graph`, `/wiki/:slug` — Wiki editor, renderer, graph view, search
- `/projects`, `/projects/:id`, `/compare` — Projects list, detail, comparison
- `/equipment`, `/livestock`, `/production`, `/employees`, `/inventory` — Operational modules with inline-editable tables
- `/financials` — Three-statement financial model (6-yr audited data, ratios, enterprise breakdown)

Shared UI: `AppShell`, `Sidebar`, `BottomNav`, `CommandPalette`, `QuickAddFAB`, `ZARInput`, `EditableCell`, `FactSheetButton`, `MetricCard`, `ProjectModal`, `ScenarioEditor`, `CashFlowEditor`.

## Setup & Run

```bash
npm install
npm run dev       # vite dev server
npm run build     # tsc -b && vite build (strict)
npm run preview   # preview built bundle
npm run lint
```

Env vars (`.env` / Vercel project settings):

- `VITE_API_URL` — API base URL. Production default: `https://cloudskraal-api.onrender.com/api`.

`vercel.json` rewrites all paths to `/index.html` for SPA routing.

## Architecture

```
src/
  App.tsx             React Router routes
  main.tsx            Entry
  api/                Typed API clients (client, config, farms, livestock,
                      equipment, employees, inventory, production, financials,
                      calendar, wiki)
  components/
    layout/           AppShell, BottomNav
    calendar/         MonthView, TaskList, TaskEditor, TaskDetail, EventEditor
    financials/       ThreeStatementModel
    map/              FarmMap (MapLibre), FieldPanel, LayerControl, MapControls
    wiki/             WikiEditor, WikiRenderer, WikiInlineEditor, WikiGraph
                      (d3-force), WikiSearch, SlashCommandMenu
    (root)            Sidebar, CommandPalette, QuickAddFAB, MetricCard,
                      ProjectModal, ScenarioEditor, CashFlowEditor,
                      EditableCell, ZARInput, FactSheetButton
  pages/              One file per route
  types/              farm, calendar, phase2, phase3, index
  utils/format.ts     Formatters (ZAR, etc.)
  assets/             hero.png, logos
public/               favicon.svg, icons.svg
stich_design/         stitch.zip — original Stitch AI design import (reference
                      only; not bundled)
```

Stack: React 19, React Router 7, Tailwind v4 (via `@tailwindcss/vite`), MapLibre GL, Recharts, TanStack Table, d3-force, markdown-it, lucide-react.

## Roadmap

Derived from recent commits and module gaps. Recently shipped: Notion-style inline editing, three-statement financial model, clickable dashboard charts, Quick Add FAB, inline-editable tables, field panel actions.

- [ ] Wire remaining modules to real API endpoints (several `src/api/*.ts` clients exist; verify full CRUD coverage end-to-end)
- [ ] Wiki graph polish (d3-force layout tuning, keyboard nav)
- [ ] Calendar recurring tasks + reminders
- [ ] Map: additional layers (soil, yield, rainfall), measurement tools
- [ ] Reverse-waterfall pricing/breakeven view for enterprise planning (per Alex's UX preference)
- [ ] Scenario comparison export (PDF/XLSX)
- [ ] Offline cache / optimistic updates for inline edits
- [ ] Auth + user roles
- [ ] Phase 2/3 types (`types/phase2.ts`, `types/phase3.ts`) — confirm wired into UI

## Known Bugs

- None identified in source (no `TODO`/`FIXME`/`HACK` markers in `src/`). Two recent commits fixed TypeScript strict-mode build errors for Vercel; watch for regressions on new strict flags.

See `BUGS.md` and `ROADMAP.md` for ongoing tracking.
