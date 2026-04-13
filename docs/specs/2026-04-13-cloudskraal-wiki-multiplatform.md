# Cloudskraal Wiki — Multiplatform Spec

> **Status:** Future implementation. Spec written 2026-04-13.
> **Priority:** Phase 2 — after current wiki editor stabilization.

---

## 1. Overview

Cloudskraal Wiki becomes a multiplatform knowledge system: web app (current), iPhone app (offline-first), and Mac desktop app (Electron). All three share a single backend API. Each has a purpose-built frontend optimized for its context.

**Goal:** Any team member can access, edit, and sync farm knowledge from any device, online or offline.

---

## 2. Architecture

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Web App    │  │  iPhone App │  │  Desktop App│
│  (React)    │  │  (React     │  │  (Electron  │
│  Vite SPA   │  │   Native or │  │   + React)  │
│             │  │   Capacitor)│  │             │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       │    REST API    │    REST API    │
       └────────┬───────┴────────┬───────┘
                │                │
         ┌──────┴────────────────┴──────┐
         │     Backend API Server       │
         │  Express + SQLite + FTS5     │
         │  Auth + RBAC + Sync Engine   │
         └──────────────────────────────┘
```

### 2.1 Shared Backend (single server)

- **Current:** Express + better-sqlite3 on VPS
- **Add:** Authentication (JWT), role-based access control, sync endpoint
- **API versioning:** `/api/v1/wiki/...` for all wiki endpoints
- **Sync protocol:** Timestamp-based with conflict resolution (last-write-wins with manual merge option)
- **Backup:** Automated daily SQLite backup to S3/Backblaze B2

### 2.2 Web Frontend (current — React + Vite)

- Already built. Continues as the primary editing interface.
- Accessed at `app.cloudskraal.co.za` or similar.
- No offline support (relies on connectivity).
- Full admin interface for user management.

### 2.3 iPhone App

- **Framework:** Capacitor (wraps existing React app) or React Native (native feel)
- **Recommended:** Capacitor — reuses 80% of web codebase, adds native plugins
- **Local storage:** SQLite on-device (via `@capacitor-community/sqlite`)
- **Offline:** Full local copy of all wiki pages. Edit offline, queue changes.
- **Sync:** On app open + periodic background sync + manual pull-to-refresh
- **Conflict resolution:** If server version is newer, show diff and let user choose
- **Native features:**
  - Camera → attach photos to wiki pages
  - Voice recording → transcribe to text, append to page
  - GPS → auto-tag field location on new pages
  - Push notifications → alert when shared page is updated
- **App Store:** Distributed via TestFlight initially, then App Store

### 2.4 Mac Desktop App

- **Framework:** Electron (wraps React app, like Obsidian)
- **Local storage:** SQLite on-disk via better-sqlite3 (same as backend)
- **Offline:** Full local copy, same as iPhone
- **Native features:**
  - Cmd+Tab, Dock icon, native menus
  - File drag-and-drop (images into wiki pages)
  - System notifications
  - Auto-launch on login (optional)
  - Spotlight integration (search wiki from macOS Spotlight)
- **Distribution:** Direct download `.dmg`, or Mac App Store

---

## 3. Access Control (Three-Tier RBAC)

### 3.1 Roles

| Role | Description | Typical user |
|------|-------------|-------------|
| **Admin** | Full access. Manage users, delete pages, access all modules. | Alex (owner) |
| **Editor** | Create and edit wiki pages. No delete. No user management. | Farm manager, section foreman |
| **Viewer** | Read-only access to permitted pages. | Seasonal workers, contractors |

### 3.2 Permissions Matrix

| Action | Admin | Editor | Viewer |
|--------|-------|--------|--------|
| View wiki pages | All | All | Permitted only |
| Create pages | Yes | Yes | No |
| Edit pages | Yes | Yes | No |
| Delete pages | Yes | No | No |
| Manage users | Yes | No | No |
| View financials | Yes | No | No |
| View equipment/livestock | Yes | Yes | Read-only |
| View farm map | Yes | Yes | Yes |
| View calendar/tasks | Yes | Yes | Assigned only |

### 3.3 Authentication

- **Method:** Email + password with JWT tokens
- **Session:** Access token (15min) + refresh token (30 days)
- **Device registration:** Each device gets a unique device ID for sync tracking
- **Future:** Invite links for onboarding new users (no self-registration)

---

## 4. Cross-Module Integration

### 4.1 Farm Map → Wiki

- Each field in the map database gets an optional `wiki_page_id` foreign key
- Tapping a field on the map shows a "Wiki" button if a linked page exists
- Wiki pages can embed a field reference: `[[field:BK-01]]` renders as a field card with area, enterprise, and current status
- Auto-suggest: when creating a wiki page with a field code in the title, offer to link it

### 4.2 Calendar/Tasks → Wiki

- Tasks can have an optional `wiki_page_id` — links to an SOP or protocol
- Wiki pages show a "Related Tasks" section (pulled from calendar API)
- Example: "Spraying Protocol" wiki page shows upcoming spray tasks
- Slash command `/task` in wiki editor inserts a task reference

### 4.3 Equipment/Livestock/Production → Wiki

- Each entity (equipment item, livestock group, production batch) gets an optional `wiki_page_id`
- Entity detail pages show a "Wiki" tab with the linked knowledge page
- Example: "Bovic Cutter" equipment page links to "Bovic Cutter Maintenance" wiki page
- Bidirectional: wiki page shows the linked entity's current status

### 4.4 Weather → Wiki (future)

- Frost alert triggers notification linking to "Frost Protection Protocol" wiki page
- Wiki pages can embed live weather widget: `{{weather:current}}`

---

## 5. Offline Sync Protocol

### 5.1 Data Model

Each device maintains:
- `local_wiki_pages` — full copy of all wiki pages
- `sync_queue` — pending changes not yet pushed to server
- `last_sync_timestamp` — per-device high-water mark

### 5.2 Sync Flow

```
Device opens app
  → Compare last_sync_timestamp with server
  → Pull all pages updated since last_sync
  → Push all queued local changes
  → Resolve conflicts (see 5.3)
  → Update last_sync_timestamp
```

### 5.3 Conflict Resolution

- **No conflict:** Local change + no server change → push local
- **No conflict:** Server change + no local change → pull server
- **Conflict:** Both changed same page since last sync →
  1. Show diff to user
  2. Options: Keep mine / Keep theirs / Merge manually
  3. Version history preserves both versions regardless

### 5.4 What syncs

- Wiki pages (title, body, category, enterprise, tags, aliases)
- Wiki links (auto-rebuilt on sync)
- Revision history
- User/role assignments
- NOT synced: FTS index (rebuilt locally), graph cache, session state

---

## 6. Data Safety

### 6.1 Version History (already built)

- Every edit creates a revision in `wiki_revisions`
- Revisions never deleted
- Diff view available in sidebar

### 6.2 Soft Delete

- Deleted pages moved to `wiki_trash` table with `deleted_at` timestamp
- 30-day retention before permanent deletion
- Admin can restore from trash
- Trash visible in admin panel only

### 6.3 Automated Backups

- Daily SQLite database backup to cloud storage (Backblaze B2 or S3)
- 30-day rolling retention
- Backup verification: restore test monthly
- Alert if backup fails

### 6.4 Audit Trail

- `wiki_audit_log` table: `user_id, action, page_id, timestamp, details`
- Actions logged: create, edit, delete, restore, permission_change
- Visible to Admin only
- 90-day retention

---

## 7. Implementation Phases

### Phase 1: Backend Auth + RBAC (1-2 weeks)
- JWT authentication
- User/role management API
- Permission middleware on all endpoints
- Soft delete + trash
- Audit trail

### Phase 2: Cross-Module Integration (1-2 weeks)
- Field → wiki linking (Farm Map)
- Task → wiki linking (Calendar)
- Entity → wiki linking (Equipment, Livestock, Production)
- UI updates in each module to show wiki links

### Phase 3: Desktop App — Electron (1 week)
- Electron wrapper around existing web app
- Local SQLite for offline storage
- Sync engine
- Native macOS integration (Dock, menus, notifications)
- `.dmg` distribution

### Phase 4: iPhone App — Capacitor (2-3 weeks)
- Capacitor wrapper
- Local SQLite (capacitor-sqlite)
- Sync engine (shared with desktop)
- Camera + voice + GPS native plugins
- Offline queue + conflict resolution UI
- TestFlight distribution

### Phase 5: Polish + Safety (1 week)
- Automated backups
- Backup verification
- Performance testing with 100+ pages
- Sync stress testing (multiple devices editing same page)
- Security audit

---

## 8. Tech Stack Summary

| Component | Technology |
|-----------|-----------|
| Backend API | Express.js + better-sqlite3 + FTS5 |
| Auth | JWT (jsonwebtoken) + bcrypt |
| Web frontend | React 19 + Vite + Tailwind + CodeMirror 6 |
| Desktop app | Electron + same React app |
| iPhone app | Capacitor + same React app + native plugins |
| Local DB (mobile/desktop) | SQLite (better-sqlite3 / capacitor-sqlite) |
| Backup storage | Backblaze B2 or AWS S3 |
| Distribution | Web: Vercel/VPS. Desktop: .dmg. Mobile: TestFlight → App Store |

---

## 9. Open Questions

1. **Domain:** What URL for the web app? `app.cloudskraal.co.za`?
2. **First users:** Who are the first Editor and Viewer users? Names/emails needed for account setup.
3. **Voice transcription:** Use Apple's on-device Speech-to-Text (free, private) or a cloud API (Whisper, more accurate)?
4. **Sync frequency:** Real-time (WebSocket) or periodic (every 5 min)? Real-time is better UX but more complex.
5. **Budget:** Backblaze B2 is ~$0.005/GB/month. Estimated cost for daily backups of a <100MB database: ~$0.05/month.
