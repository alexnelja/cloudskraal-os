# Known Bugs

No TODO/FIXME markers currently in `backend/src` or `frontend/src`.

## Open

- [ ] TBD — file here as found

## Recently fixed

- Flaky test-suite teardown — `measurements.test.mjs` now awaits `appModule.ready` before closing the DB, so the async boot-seed settles first (no more "database connection is not open" unhandled rejection; full suite exits 0).
- `524a9b7` — inventory page: byCategory rendering, stock merging, transaction API path
