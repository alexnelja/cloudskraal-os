# Roadmap

## Recently shipped

- Notion-style inline editing across all modules (`24e9e66`)
- Three-statement financial model with 6-yr audited data, ratios, enterprise breakdown (`97d962e`)
- Quick task complete, field panel actions (`cdf20b6`)
- Inline-editable tables for equipment, livestock, inventory (`a7b8e65`)
- Quick Add floating action button (`6b000bc`)
- Clickable dashboard charts with project detail popups (`851a696`)

## Next

- [ ] Full API coverage audit — verify every `src/api/*.ts` client has end-to-end CRUD wired into its page
- [ ] Wiki graph: d3-force layout tuning, keyboard navigation, better backlinks UI
- [ ] Calendar: recurring tasks, reminders, iCal export
- [ ] Map: soil / yield / rainfall layers, distance + area measurement tools
- [ ] Reverse-waterfall pricing/breakeven view for enterprise planning (Alex UX pref: sell price in → breakeven buy price out)
- [ ] Scenario comparison export (PDF / XLSX)
- [ ] Offline cache + optimistic updates for inline edits
- [ ] Auth and user roles
- [ ] Confirm `types/phase2.ts` and `types/phase3.ts` are fully wired through UI

## Later

- [ ] Mobile refinements (BottomNav already present — audit all pages on small viewports)
- [ ] Command palette: fuzzy search across all entities
- [ ] Dashboard: configurable widgets
- [ ] Dark mode audit

## Design source

`stich_design/stitch.zip` — original Stitch AI export. Reference only; not bundled. Re-import when refreshing visual direction.
