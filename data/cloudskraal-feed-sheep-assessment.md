# Cloudskraal Feed & Sheep Management Assessment

> Review of the Cloudskraal Feed Calculator v2 against industry best practices for Dohne Merino production in the Hantam Karoo / Bokkeveld region. April 2026.

---

## 1. What the Calculator Gets Right

The Feed Calculator is a well-structured tool. Several elements align closely with best practice:

**NRC-based nutrient targets.** The nutrient requirements sheet references NRC (2007) for a 60 kg mature Dohne Merino ewe, which is the correct standard reference. The ME, CP, Ca, and P values for each production phase (maintenance through peak lactation) are consistent with published NRC figures for medium-wool breeds at this body weight.

**Phase-based feeding.** The six-phase annual cycle (Mid Pregnancy → Late Pregnancy → Early Lactation → Peak Lactation → Weaning → Flushing) is textbook for autumn-mated Merino flocks in the winter-rainfall zone. Splitting twin-bearers from single-bearers within each phase reflects the strong recommendation from both NRC and UK/SA advisory bodies to feed ewes according to the number of foetuses carried — scanning is being used effectively here.

**Gap analysis approach.** The "Supplement Gap Analysis" sheet — which calculates the difference between what grazing provides and what the ewe needs, then sizes the supplement to fill that gap — is exactly the right conceptual framework. It avoids both over-supplementation (wasteful) and under-supplementation (production losses).

**Own-farm feed ingredients.** The ingredient database includes home-grown rye, barley, wheat, lupins, and lucerne, all costed at farm-gate prices. Using on-farm feeds as the backbone of the ration keeps costs down and is standard practice for Bokkeveld farms with arable land.

**Mineral and vitamin inclusion.** The mixes include salt, feed lime, monocalcium phosphate, and a vitamin/mineral premix — all critical for sheep on Karoo-type veld where mineral deficiencies (especially phosphorus) are well documented.

---

## 2. Data Issues and Errors in the Calculator

### 2.1 Cost Summary only counts twin-bearers (250 head) — missing ~700 head

This is the single biggest issue. In the Cost Summary sheet, phases 1–4 all show a Head Count of **250** (twin-bearing ewes only). But the Flock Calculator shows that **both twin-bearers (250) and single-bearers (450)** receive supplementary feed in every phase. The 30 dry ewes and 200 replacements also receive feed in some phases.

**Impact:** The annual cost of ~R265,741 is significantly understated. A rough corrected estimate, accounting for all groups at their respective supplement rates, would be closer to **R550,000–R650,000 per year** — roughly double.

### 2.2 Phase 5 (Weaning) shows 0 head and R0 cost

The Flock Calculator specifies 700 ewes at 150 g/day and 0 weaners (weaners entered as 0, presumably not yet weaned at the time the sheet was filled in). But the Cost Summary shows **0 head** and **R0** for this phase. Even without weaners, the 700 ewes on 150 g/day maintenance supplement should be costed. This is approximately R3,150 kg/month × ~R4.50/kg = ~R14,175/month, or ~R28,350 for the 2-month phase.

### 2.3 Weaners entered as 0 head throughout

The flock has 700 pregnant ewes (250 twins + 450 singles). At even a conservative 130% lambing rate, that produces ~910 lambs, of which perhaps 650–750 survive to weaning. These weaners need to appear in phases 4 (creep feeding) and 5 (post-weaning grower), but they're currently entered as **0** everywhere. This means the creep feed and grower feed costs are entirely absent from the model.

### 2.4 Mix Designer totals don't always sum to 100 kg

Phase 1 (Mid Pregnancy) mix totals **99 kg/100kg** — 1 kg is unaccounted for. While small, this cascades through all the cost and nutrient calculations for that phase. Each mix should sum to exactly 100.

### 2.5 Ca:P ratios deserve a second look

The NRC recommends a Ca:P ratio between 1.0:1 and 2.0:1 for sheep, with 1.5:1 being typical. Several of the mixes show ratios at the extremes (e.g., Phase 1 at 1.86:1, Phase 2 at 1.51:1). These are within range, but the Late Pregnancy mix for twins should ideally be closer to 2:1 given the calcium demands of foetal bone mineralisation in the last 4 weeks.

### 2.6 No body condition score (BCS) reference anywhere

The calculator is purely quantitative (kg, MJ, g CP) but includes no mention of target body condition scores for each phase. BCS is the single most practical management tool for adjusting feeding levels in real time. Best practice is to target BCS 3.0–3.5 at joining, maintain ≥2.5 through pregnancy, and not let ewes drop below 2.0 at any point.

---

## 3. Carrying Capacity: The Elephant in the Kraal

The Grazing Planner reveals a **critical structural deficit**:

| Metric | Value |
|--------|-------|
| Natural veld | 500 ha at 8 ha/LSU = 62.5 LSU |
| Improved pasture (rye, barley, lucerne) | 160 ha at ~2 ha/LSU = 70 LSU |
| **Total carrying capacity** | **~530 ewes with lambs** |
| **Current flock** | **~900+ head (955 including rams/replacements)** |
| **Deficit** | **–370 head** |

The calculator itself flags this deficit. This is the most serious strategic concern. Running 70% above carrying capacity is not sustainable and carries several compounding risks: veld degradation (especially the 500 ha of natural veld), poor animal condition despite supplementation, higher feed costs to compensate for inadequate grazing, and long-term loss of the veld resource that underpins the whole sheep enterprise.

**What research says for this region:** Studies on small-scale sheep farming in the Hantam Karoo consistently identify overgrazing as the primary threat to sustainability. The departmental grazing capacity for Northern Cape semi-arid veld ranges from 6–12 ha/LSU depending on condition and rainfall — and the 8 ha/LSU used in the calculator is reasonable for Bokkeveld plateau. However, veld carrying capacity is not fixed; it varies with rainfall, and in drought years can halve. The calculator uses a static figure.

### Recommendations on carrying capacity

The realistic options are to reduce the flock to match carrying capacity (~530 breeding ewes plus followers), increase improved pasture area (every additional 10 ha of irrigated lucerne adds capacity for ~20 ewes with lambs), or accept that the operation is fundamentally a "feedlot on veld" and budget accordingly — but this last option means the R265K feed budget is an illusion; the real figure with full flock numbers is much higher.

---

## 4. Best-Practice Comparison by Phase

### Phase 1: Mid Pregnancy (Feb–Apr)

| Aspect | Cloudskraal | Best Practice | Assessment |
|--------|-------------|---------------|------------|
| Supplement rate (twins) | 300 g/d | 200–350 g/d | ✅ Good |
| Supplement rate (singles) | 200 g/d | 100–200 g/d | ✅ Good |
| Mix ME | 10.8 MJ/kg | ≥9.0 MJ/kg | ✅ Exceeds minimum |
| Mix CP | 20.4% | ≥12% | ✅ Well above minimum |
| Roughage basis | Natural veld (green) | Green veld adequate | ✅ Correct timing |

**Verdict:** This phase is well managed. The CP is actually higher than strictly necessary for mid-pregnancy (NRC recommends ~9.5% of total diet CP), but since the supplement is a small proportion of total intake and the veld CP is lower, the net effect is appropriate. No changes needed.

### Phase 2: Late Pregnancy (Apr–May)

| Aspect | Cloudskraal | Best Practice | Assessment |
|--------|-------------|---------------|------------|
| Supplement rate (twins) | 500 g/d | 500–700 g/d | ✅ Adequate |
| Supplement rate (singles) | 300 g/d | 300–400 g/d | ✅ Adequate |
| Mix ME | 11.6 MJ/kg | ≥11.0 MJ/kg | ✅ Meets target |
| Mix CP | 19.6% | ≥18% | ✅ Meets target |
| Twin lamb disease prevention | Not mentioned | BCS monitoring, twice-daily feeding, 45cm trough space/ewe | ⚠️ Gap |

**Verdict:** Nutritional specs are sound. The gap is management protocol — twin lamb disease (pregnancy toxaemia) is the highest-risk condition at this stage, and the calculator doesn't reference BCS targets, feeding frequency, or trough space guidelines. Best practice from NADIS and Scottish advisory services recommends feeding concentrates twice daily when rates exceed 450 g/day, and ensuring 45 cm of trough space per ewe to prevent shy feeders from going short.

### Phase 3 & 4: Early and Peak Lactation (May–Jul)

| Aspect | Cloudskraal | Best Practice | Assessment |
|--------|-------------|---------------|------------|
| Supplement rate (twins) | 800 g/d | 800–1,000 g/d | ✅ Good |
| Supplement rate (singles) | 500 g/d | 400–600 g/d | ✅ Good |
| Lucerne hay addition | 1 kg/day for twins | Recommended | ✅ Excellent |
| Mix ME target | ≥13 MJ/kg | ≥12.5 MJ/kg | ✅ Ambitious and correct |
| Mix CP target | ≥20% | ≥18% | ✅ Above minimum |
| Pasture requirement | "Best rye pasture" | Critical — supplement alone cannot close energy gap | ⚠️ Risk if rye underperforms |

**Verdict:** The calculator's own gap analysis correctly flags that at 600–800 g/d, the supplement alone **cannot** close the energy gap for twin-rearing ewes — they must be on excellent rye pasture. This is the highest-risk phase. If rye pasture quality or availability drops (dry winter, late planting, overgrazing), twin-rearing ewes will lose condition rapidly, milk production will fall, and lamb mortality will spike. Given the carrying capacity deficit, this risk is real.

**Improvement:** Consider establishing a **priority paddock system** where twin-bearing ewes get first access to the best rye pasture, while singles and dry ewes run on secondary pasture and veld. This is standard practice in high-performance Merino flocks.

### Phase 5: Weaning (Aug–Sep)

| Aspect | Cloudskraal | Best Practice | Assessment |
|--------|-------------|---------------|------------|
| Ewe supplement | 150 g/d | 100–200 g/d maintenance | ✅ Fine |
| Weaner supplement | 300 g/d | 250–400 g/d | ✅ Appropriate |
| Weaner head count | **0** | Should be 600–750+ | ❌ Missing |
| Creep feeding pre-weaning | Not modelled | Recommended from 2–3 weeks | ⚠️ Gap |

**Verdict:** The weaner component is completely absent from the model. This is a significant omission both for costing and for production. Research consistently shows that creep feeding from 2–3 weeks of age improves weaning weights by 3–5 kg, which translates directly into higher sale prices and better replacement ewe development.

### Phase 6: Flushing (Sep–Oct)

| Aspect | Cloudskraal | Best Practice | Assessment |
|--------|-------------|---------------|------------|
| Supplement rate | 500 g/d | 300–500 g/d | ✅ Good |
| Duration | ~2 months | 3–4 weeks pre-joining + first 3 weeks | ⚠️ Possibly too long |
| ME delivered | High (spring veld + 500g supplement) | Rapid weight gain targeted | ✅ Aligned |
| Target BCS at joining | Not specified | 3.0–3.5 | ⚠️ Should be explicit |
| Cost share | 38% of annual feed | Typically 10–15% | ⚠️ Disproportionate |

**Verdict:** Flushing at 500 g/d for all 730 ewes + 200 replacements + 25 rams for a full 2 months is expensive — it accounts for 38% of the (understated) annual feed budget. Best practice is to flush for 3–4 weeks before joining and continue for the first 2–3 weeks of joining (~6 weeks total, not 8). Shortening the flushing window by 2–3 weeks would save ~R25,000–R30,000 per year with minimal impact on conception rates, provided ewes are already in BCS ≥2.5 coming off lactation.

The other option is to target flushing more selectively — ewes in BCS 3.0+ don't need aggressive flushing and respond less to it. Only ewes in BCS 2.0–2.5 benefit meaningfully. This requires condition scoring before flushing begins.

---

## 5. Strategic Improvements — Summary

### Must-fix (data/calculation errors)

1. **Correct the Cost Summary** to include all animal groups (single-bearers, replacements, dry ewes) — not just the 250 twin-bearers.
2. **Enter realistic weaner numbers** (likely 600–750 head) into the Flock Calculator for phases 4 and 5.
3. **Fix Phase 1 mix** to sum to exactly 100 kg/100kg.
4. **Fix Phase 5** in Cost Summary — currently shows 0 head / R0 despite ewes being supplemented.

### Should-do (management improvements)

5. **Add BCS targets** to the Nutrient Requirements sheet for each phase (target BCS column).
6. **Implement priority paddock allocation** — twin-bearing ewes get first access to best rye pasture during lactation.
7. **Introduce creep feeding** for lambs from 2–3 weeks of age (high-ME pellet at 50–150 g/d).
8. **Shorten flushing duration** from 2 months to ~6 weeks, and consider condition-scoring ewes to target flushing supplementation.
9. **Add a twice-daily feeding note** for late pregnancy concentrate feeding (>450 g/d) to reduce twin lamb disease risk.
10. **Add trough space calculation** — 45 cm per ewe for concentrate feeding in late pregnancy and lactation.

### Strategic (carrying capacity)

11. **Address the –370 head carrying capacity deficit.** Options include reducing the flock (most ecologically responsible), expanding irrigated pasture (capital-intensive but aligns with the Meulsteenvlei expansion plans), or accepting higher feed costs and budgeting accordingly.
12. **Make carrying capacity dynamic** — the 8 ha/LSU figure should be adjusted annually based on rainfall and veld condition assessments. In drought years, early destocking decisions save both veld and money.
13. **Consider a rotational grazing system** for the 500 ha of natural veld — research from the Central Karoo consistently shows that rotational rest improves veld condition and long-term carrying capacity.

---

## 6. Financial Impact Estimate

| Item | Current (calculator) | Corrected estimate |
|------|--------------------|--------------------|
| Annual feed cost (total flock) | R265,741 | **R550,000–R650,000** |
| Feed cost per pregnant ewe | R380 | **R780–R930** |
| Missing weaner feed cost | R0 | **R80,000–R120,000** |
| Potential flushing savings | — | **R25,000–R30,000** |

Against sheep/wool revenue of ~R1.58M (FY2025), a corrected feed cost of R550,000–R650,000 means feed represents **35–41% of gross sheep revenue** — which is on the high side for extensive Karoo operations (typical target is 25–30%). This reinforces the carrying capacity issue: the flock is larger than the land can support at low cost, so feed imports bridge the gap at a premium.

---

## 7. What's Working Well — Don't Change

- The NRC-based nutritional framework is solid and well-researched.
- Scanning and splitting twin/single management groups is excellent practice.
- Using on-farm grains and lupins as the supplement backbone is cost-effective.
- The ingredient database with ME, CP, NDF, Ca, P, and DM values is comprehensive.
- The gap analysis approach (total need minus grazing contribution = supplement target) is the right methodology.
- Lucerne hay supplementation for twin-rearing ewes during lactation is specifically recommended by multiple advisory sources.

---

*Assessment based on NRC (2007) Nutrient Requirements of Small Ruminants, NADIS pre-lambing nutrition guidelines, Elsenburg veld management guidelines for the Central Karoo, and published research on small-scale sheep farming in the Hantam Karoo.*
