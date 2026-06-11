---
title: 2026 rooibos yield + labour completion worksheet
date: 2026-06-11 Thu
type: worksheet
tags: [cloudskraal, rooibos, cop, data-quality]
---

# 2026 rooibos yield + labour completion worksheet

**Why:** the Enterprises page shows rooibos margin **−R4.57/kg** — an artefact of
asymmetric data gaps, not a real loss. Recorded: 77,000 kg wet across 10 fields and only
98 labour hours. Reality: 148,819 kg DRY delivered to Rooibos Bpk by 10 June
(≈ **330,700 kg wet** at the 0.45 wet→dry factor) and harvest labour ≈ 70% of rooibos CoP.
Until both gaps close, no per-field cost/kg or margin is trustworthy.
Processing batches are empty (0 rows), so the 2e back-fill route is unavailable —
this needs your numbers. Fill the blanks; any session can ingest this file on request.

## A. Delivered loads → camp → field mapping (fill the field column)

Wet-equivalent = gross dry ÷ 0.45. Camp names don't match app field names —
only you can map them. Candidates noted where names suggest a match.

| Load | Date | Camp (Rooibos Bpk) | Dry kg | ≈ Wet kg | App field(s) → fill in |
|---|---|---|---|---|---|
| D260324 | 17/03 | Kamp 1 | 29,212.0 | 64,916 | ____________ |
| D260349 | 20/03 | Agter Beefwoods | 29,112.0 | 64,693 | ____________ |
| D260479 | 16/04 | Elandsvoetpad | 20,208.0 | 44,907 | ____________ |
| D260480 | 16/04 | Kromvlei | 9,749.6 | 21,666 | ______ (candidates: "Kromvlei Rooibos", "kromvlei Rooibos 2", "Kromvlei", "KV …") |
| D260531 | 28/04 | Pleisterbosrug | 30,154.4 | 67,010 | ____________ |
| D260545 | 20/05 | Leeukamp | 30,383.2 | 67,518 | ____________ |
| **Total** | | | **148,819.2** | **≈330,709** | |

Also note tea NOT delivered (kept back / Cape Natural loads e.g. MAT-0379 24,700 kg dry
≈ 54,889 kg wet): ____________

## B. Costed fields missing 2026 yields (the DQ card's worklist)

These six carry R313k of recorded cost and zero yield — they do the most damage
to cost/kg. Enter wet kg harvested (0 is also an answer if a field wasn't cut in 2026 —
then the cost is establishment/maintenance and should be flagged accordingly).

| Field | ha | 2026 cost | Wet kg harvested → fill in |
|---|---|---|---|
| G3: Bakenkamp | 54.6 | R104,904 | ______ |
| B3: Biekoes Hardekop | 32.8 | R62,916 | ______ |
| C7: Withope | 29.6 | R56,928 | ______ |
| C8: Eerste Spilpunt | 21.7 | R41,592 | ______ |
| B5: Straatklip | 17.1 | R32,856 | ______ |
| C10: Nuweland op Krans | 7.2 | R13,764 | ______ |

Already recorded (sanity-check these while you're at it — Σ 77,000 kg wet):
Pomparea 25,000 · Heelagter 15,000 · Cloudskraal Hardekop 12,000 · Driehoekkamp 7,000 ·
Links van Vlei 6,000 · Langland 5,000 · By Resevoir 2,000 · Spilpuntkamp 2,000 ·
Damkamp 2,000 · Sementdamkamp 1,000.

## C. Harvest labour capture — use the new task lifecycle (shipped 11 Jun)

Per harvested field, one retroactive *teesny* task closes the labour gap and posts
straight into COP:

1. Map → right-click the field → **Teesny (harvest)** suggestion tile (or POST
   `/api/tasks` with `template_id: "tpl-roo-harvest"`).
2. `POST /api/tasks/:id/transition` `{to_state:"in_progress", at:"<harvest start>"}`
3. `… {to_state:"completed", at:"<harvest end>", actual_area_ha: <ha cut>}`
4. `… {to_state:"verified", by:"Alex", workers:[{employee_id, hours}, …]}` —
   this writes the `time_entries` (tagged to the task and field) that COP reads.

Team and hours per camp: only in your records → fill in per load:

| Camp | Team size | Days | ≈ Hours total |
|---|---|---|---|
| Kamp 1 | ____ | ____ | ____ |
| Agter Beefwoods | ____ | ____ | ____ |
| Elandsvoetpad | ____ | ____ | ____ |
| Kromvlei | ____ | ____ | ____ |
| Pleisterbosrug | ____ | ____ | ____ |
| Leeukamp | ____ | ____ | ____ |

## D. Reconciliation targets (when A–C are in)

- Σ per-field wet yields ≈ **330,700 kg** (delivered) + kept-back/CN volumes.
- Labour cost ÷ 148,819 dry kg should land ≈ **R8–18/kg dry** (Elsenburg band);
  outside that → revisit hours or rates.
- Enterprises page margin then compares against R39.60 gross netto; for realised-net
  sensitivity use the Cost Map what-if price override at **R28.26 (RB net)** and
  **~R35 (CN net)** — see `rooibos-buyers-quality-sifts-pricing-2026.md`.
- DQ card target: zero rooibos `costed_no_yield` lines.
