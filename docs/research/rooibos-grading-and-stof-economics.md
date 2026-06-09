# Rooibos sift grading + stof economics (Alex, 2026-06)

Source: Alex (Cloudskraal). Captures how offtakers actually grade delivered dry
rooibos and the value hidden in the fine fractions. **Materially changes the 2e
processing model** — "stof" is not waste; it is graded superfine/ultrafine with
real and rising market value.

> Items marked ⚠ need confirmation before being hard-coded into the model.

## Sift grading (offtaker sifter, measured in holes per inch)

The companies that buy from us run the dry tea through a sifter; the **final
sifted output** is what's paid on. Grading by mesh (holes per inch — higher =
finer particle):

| Fraction | Mesh (holes/inch) | Name | Use |
|---|---|---|---|
| Coarsest | **< 10** | **stokke** (sticks) | not netto; (we recirculate — see 2e.2) |
| Mid | **10–40** | **actual netto** | the graded, sold tea (cut tea) |
| Fine | **40–60** | **superfine** | red espresso ("red cappuccino") product |
| Finest | **> 60** | **ultrafine** | granules added to teabags (boosts taste/intensity); spray-dried into fully-soluble instant rooibos |

So the **netto denominator is specifically the 10–40 fraction**, and what our
schema currently calls "stof" is really the **>40 fines** (superfine + ultrafine).

## Spray drying → instant rooibos

Confirmed: for normal tea, per ~1 ton input → **~1:10 hot-soluble** + **~1:50
cold-soluble** instant out (hot soluble = dissolves in hot water; cold soluble =
dissolves in cold, harder/lower yield).

## Processing flow (wet → dry → sifted)

1. **Wet harvest**: a fermentation heap is usually **12–20 tonnes** of wet harvested tea.
2. Fed through **cutters** ("tee kerwers"/carvers) that chop the wet bushels into fine tea.
3. **~800 kg of reprocessed fines** (stof + stokke, via the **corncutter**) is added back
   onto the fermentation heap — this is the internal **colour** addition (variable, ~800 kg/heap).
4. **Fermented overnight**.
5. Spread across the **drying court** ("ding court") and **dried the following day**.
6. Picked up dry and **stored for sifting** into the mesh fractions.

## Current practice & economics

- Of the dried output, the **stof (4%)** and **stokke (9%)** are currently **reprocessed
  through the corncutter and added back onto the fermentation heap** (the ~800 kg/heap
  colour addition). Netto (87%, the 10–40 fraction) is the sold tea.
- So **both fine streams currently recirculate** — they are not sold today. The change:
  stof now has a **market at R24/kg (up from R6/kg in 2025, ~4×)**, so selling it (or
  value-adding it) is the emerging alternative to recirculating it for colour.
- The **play** below = divert the stof out of recirculation into higher-value
  superfine/ultrafine + instant tea.
- ✓ Reconciled: the seed split netto 87% / stokke 9% / **stof 4%** matches — stof is the
  >40 fines; both stof + stokke recirculate via the corncutter.

## The play (project — in progress)

Alex is developing a plan to:
1. **Further reprocess the +40 fines currently in stock** into separated
   **superfine** and **ultrafine** grades (capturing more value than selling
   undifferentiated stof at R24/kg).
2. **Possibly pay for processing and market the instant tea ourselves** — vertical
   integration into fully-soluble instant rooibos rather than selling fines to
   offtakers.

Economic driver: the R6→R24 jump shows the fines are increasingly valuable; doing
the fine-separation and/or instant-tea processing in-house captures that margin
instead of handing it to offtakers.

## Modelling implications for COP (2e / future)

- Replace the single `stof_kg` + `stof_price_zar_per_kg` with **graded fine
  fractions**: `superfine_kg` (40–60) and `ultrafine_kg` (>60), each with its own
  value/use, plus the netto = 10–40 and stokke = <10.
- **Both stof (4%) and stokke (9%) currently recirculate** (corncutter → fermentation
  heap, ~800 kg/12–20 t heap) for colour — our 2e.2 recirculation models only stokke;
  a refinement should treat stof recirculation the same way (internal use, not revenue),
  and let the play *divert* stof from recirculation to sale/value-add.
- A **scenario model** for the play: compare (a) sell undifferentiated stof @R24/kg
  vs (b) separate into superfine/ultrafine and sell graded vs (c) process to
  instant tea and market it — capex, processing cost, yields, prices.
