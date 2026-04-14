# Cloudskraal CapEx

Capital expenditure planning and enterprise-management platform for Cloudskraal farm (Western Cape, SA). Covers Dohne Merino sheep, rooibos, wine grapes, lupines/oats rotation, and the broader Nel family estate. Frontend is React 19 + Vite + TypeScript + Tailwind 4 with MapLibre, CodeMirror 6 (Obsidian-style wiki), Recharts and a D3 knowledge graph. Backend is Express + better-sqlite3 (Turso/libsql optional) with a financial engine (NPV/IRR/WACC/payback) for evaluating 22 seeded CapEx projects.

## Status

Done:
- Full land use reconciliation — 98 fields, 2,429 ha, zero duplicates (commit `3b9c495`)
- Obsidian-style wiki: CodeMirror 6 editor, file tree, slash commands, callouts, Cmd+K palette, knowledge graph with theme toggle
- Field-level cost of production (inputs, labour, per-ha/per-kg economics)
- Rooibos stand % tracking, rotation year, replant alerts
- Supplier/customer/supply-chain import from Excel
- Vercel (frontend) + Render (backend) deploy configs
- Obsidian vault sync scripts (`vault/` <-> wiki DB)

In progress / recent untracked:
- Feed calculator v2 (`data/Cloudskraal_Feed_Calculator_v2.xlsx`)
- Feed vs. sheep assessment (`data/cloudskraal-feed-sheep-assessment.md`)
- Updated Oct-2025 master workbook, GeoJSON / KML map exports
- Wiki content expansion (`data/Wiki/`)

## Structure

```
backend/    Express API, SQLite (better-sqlite3), financial engine, Render deploy
frontend/   React 19 + Vite + TS + Tailwind 4, CodeMirror wiki, MapLibre, Recharts
data/       Source spreadsheets, GIS (geojson/kml), markdown reports, factsheets
docs/       plans/ specs/ research/ handoffs/
vault/      Obsidian-style markdown vault (enterprise + operational knowledge)
```

## Setup & Run

Backend (port 3001):
```bash
cd backend
npm install
npm run dev
```
DB auto-seeds to `backend/data/capex.db` on first run; delete to reset.

Frontend (Vite dev server):
```bash
cd frontend
npm install
npm run dev
```
Set `VITE_API_BASE_URL` to point to the backend if not localhost.

Tests:
```bash
cd backend && npm test    # vitest
```

## Roadmap

See [ROADMAP.md](./ROADMAP.md).

## Known Bugs

See [BUGS.md](./BUGS.md).
