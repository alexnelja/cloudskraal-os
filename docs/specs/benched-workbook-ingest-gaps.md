# Workbook ingest audit — Cloudskraal_October 2025.xlsx

- **Audited:** 2026-04-14
- **Status:** No further import needed. Document only.

## Sheets in the workbook

| Sheet | Rows | Status | Notes |
|---|---:|---|---|
| `Forecasted January 2021` | 1000 (all null) | **Empty** | Template stub. Skip. |
| `Farms` | 9 | Imported | `seed-excel-import.js` updates farms (water_source, power_source, infrastructure, soil_notes). |
| `Fields` | 11 | **Skip — fictional** | Template-style data ("Rooibos-1", Alice, Bob, F001). Real fields live in `seed-farms.js` + `seed-land-use-2026.js`. Confirmed during spec 2a audit. |
| `Workers` | 0 | **Empty** | No data. Real labour data lives in `seed-phase2.js` employee seed. |
| `Suppliers` | 8 | Imported | `seed-excel-import.js` |
| `Customer` | 10 | Imported | `seed-excel-import.js` |
| `Outputs` | 10 | Imported | `seed-excel-import.js` (sales table) |
| `Inputs` | 10 | Imported | `seed-excel-import.js` (inventory_transactions, fuzzy product matching) |
| `Equipment` | — | Skipped | Older format superseded by Equipment 2. |
| `Equipment 2` | 10 | Imported | `seed-excel-import.js` |
| `Sheep Flock` | 27 | Imported | `seed-excel-import.js` (livestock_groups + livestock_records + shearing_records) |
| `Rooibos - JOHAN BRAND - Werklik` | 107 | Imported | Same dataset as the standalone `Johan Brand - Rooibos Oeskatting.xlsx`, already parsed by `seed-farms.js::parseOeskatting`. Werklik columns map to `field_production.actual_yield_kg`. |
| `Rooibos - Johan Brand - Oeskatt` | 107 | Imported | Same dataset; oesskat → `field_production.estimated_yield_kg`. |
| `Copy of Oeskatting` | 107 | Imported | Duplicate of the Oeskatt sheet with extra "Column N" spacer columns. Same data. |

## Conclusion

Every non-empty sheet in the Oct-2025 workbook is already represented in the database via either `seed-excel-import.js` or `seed-farms.js::parseOeskatting`. The two new findings are:

1. **`Fields` sheet is fictional template data**, not a source of truth. Reaffirms spec 2a audit. Don't wire up an importer for it.
2. **Three Rooibos sheets contain the same dataset** already loaded from the standalone Oeskatting workbook. No re-ingest needed.

## Future improvements (not blocking)

- If the operator updates the Oct-2025 workbook quarterly, decide whether the canonical source becomes the master workbook (collapse the standalone Oeskatting load) or the operator keeps editing the standalone. Today both feed the same field_production rows; consolidation would prevent drift.
- `Equipment 2` import currently uses fuzzy farm-name match (`farm.name LIKE %word%`). If a future field code in the workbook collides with multiple farms, the import will silently pick the wrong one. Add explicit farm_id mapping when this becomes a real risk.
- `Inputs` import depends on `input_products.name LIKE %first-word%` — fragile when the catalogue grows. When ten products start with "Roundup", switch to slug or explicit code matching.

These belong in a future "data ingest hygiene" spec, not in the current session.
