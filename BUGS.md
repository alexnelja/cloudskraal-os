# Known Bugs

No TODO/FIXME markers currently in `backend/src` or `frontend/src`.

## Open

- [ ] TBD — file here as found
- [ ] **Flaky test-suite teardown (non-failing).** Full `npm test` exits 1 with one unhandled rejection — `TypeError: The database connection is not open` from `src/routes/measurements.test.mjs`. All 375 tests pass; the file passes clean in isolation. Cause: it re-`require`s `index.js`, whose async boot-seed (`initializeAndSeed`) races the per-test `schema._resetForTest()` DB close. Fix later: `await appModule.ready` before reset, or guard `index.js` auto-seed under test. Timing-dependent; not tied to any feature.

## Recently fixed

- `524a9b7` — inventory page: byCategory rendering, stock merging, transaction API path
