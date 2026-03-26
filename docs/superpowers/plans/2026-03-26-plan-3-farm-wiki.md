# Phase 1, Plan 3: Farm Wiki & Knowledge Graph

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Obsidian-style farm wiki with `[[wiki-links]]`, full-text search, a force-directed knowledge graph view, and ~40 pre-seeded pages covering rooibos cultivation, sheep management, wine, compliance, pests, inputs, and farm knowledge.

**Architecture:** Add wiki_pages and wiki_links tables to SQLite. Backend parses `[[wiki-links]]` on save, maintains a link graph. Frontend renders markdown with clickable wiki-links, a d3-force graph visualization, and full-text search. Pre-seed from Elsenburg research and strategic documents.

**Tech Stack:** Express, SQLite, React 19, TypeScript, Tailwind CSS 4, markdown-it (markdown rendering), d3-force (graph visualization), Lucide React icons

---

## File Structure

### Backend
| File | Responsibility |
|------|---------------|
| `backend/src/db/schema-wiki.js` | wiki_pages, wiki_links tables |
| `backend/src/db/seed-wiki.js` | ~40 pre-seeded wiki pages |
| `backend/src/routes/wiki.js` | CRUD, link parsing, search, graph data |
| `backend/src/services/wiki-links.js` | Parse [[links]] from markdown, resolve slugs |

### Frontend
| File | Responsibility |
|------|---------------|
| `frontend/src/pages/WikiPage.tsx` | Wiki home, page view, graph view |
| `frontend/src/components/wiki/WikiRenderer.tsx` | Markdown render with clickable [[links]] |
| `frontend/src/components/wiki/WikiEditor.tsx` | Markdown editor with preview |
| `frontend/src/components/wiki/WikiGraph.tsx` | d3-force graph visualization |
| `frontend/src/components/wiki/WikiSearch.tsx` | Search input with results dropdown |
| `frontend/src/api/wiki.ts` | API client |
| `frontend/src/types/wiki.ts` | TypeScript types |

---

## Tasks

### Task 1: Backend — Wiki schema + link parser + routes
### Task 2: Backend — Seed ~40 wiki pages
### Task 3: Frontend — Types, API client, markdown deps
### Task 4: Frontend — Wiki page view with [[link]] rendering
### Task 5: Frontend — Wiki editor + search
### Task 6: Frontend — Knowledge graph (d3-force)
### Task 7: App.tsx routes + sidebar update
