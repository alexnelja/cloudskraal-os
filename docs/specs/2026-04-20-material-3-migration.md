# Material Design 3 Migration Plan

**Date:** 2026-04-20
**Branch:** `feature/material-3`
**Strategy:** Module-by-module rewrite (option B)
**Dependency:** `@material/web` (already installed)

---

## Migration Order

| Phase | Module | Complexity | Components |
|-------|--------|-----------|------------|
| 0 | **Theme + Tokens** | Low | CSS custom properties, MD3 color scheme, typography scale |
| 1 | **Shell** (Sidebar + BottomNav + AppShell) | Medium | Navigation rail, navigation drawer, top app bar |
| 2 | **Tasks** | High | Cards, FAB, chips, dialogs, text fields, lists |
| 3 | **Calendar** | Medium | Cards, date pickers, event chips |
| 4 | **Wiki** | Medium | Cards, text fields, toolbar |
| 5 | **Financials** | Low | Tables, cards, charts (charts stay custom) |
| 6 | **Map** | Low | Overlays only — MapLibre stays as-is |
| 7 | **Polish** | Medium | Dark mode, motion tokens, responsive layouts |

---

## Phase 0: Theme + Tokens

### MD3 Color Scheme

Generate from Cloudskraal brand using `@material/material-color-utilities`:

| Role | Light | Source |
|------|-------|--------|
| Primary | `#059669` (emerald) | Farm/growth |
| Secondary | `#78716c` (stone) | Earth/neutral |
| Tertiary | `#d97706` (amber) | Harvest/warmth |
| Error | `#dc2626` (red) | Standard |
| Surface | `#fffbfe` | MD3 default |
| Surface Container | `#f2f2f7` | Apple system grouped bg (keep for familiarity) |

### Typography Scale

Map current custom sizes to MD3 type scale:

| MD3 Role | Current | MD3 Size | Usage |
|----------|---------|----------|-------|
| Display Large | `text-[34px] font-bold` | 57px | Not used (too large) |
| Headline Large | `text-[34px] font-bold` | 32px | Page titles (Today, All) |
| Headline Medium | `text-2xl font-serif` | 28px | Section headers |
| Title Large | `text-xl` | 22px | Card titles |
| Title Medium | `text-[15px] font-medium` | 16px | Task titles |
| Body Large | `text-[15px]` | 16px | Body text |
| Body Medium | `text-[13px]` | 14px | Metadata |
| Label Large | `text-[13px] font-medium` | 14px | Buttons |
| Label Medium | `text-[11px] uppercase` | 12px | Category headers |
| Label Small | `text-[10px]` | 11px | Badges |

### CSS Custom Properties

```css
:root {
  /* MD3 Color Tokens */
  --md-sys-color-primary: #059669;
  --md-sys-color-on-primary: #ffffff;
  --md-sys-color-primary-container: #a7f3d0;
  --md-sys-color-secondary: #78716c;
  --md-sys-color-tertiary: #d97706;
  --md-sys-color-error: #dc2626;
  --md-sys-color-surface: #fffbfe;
  --md-sys-color-surface-container: #f2f2f7;
  --md-sys-color-surface-container-low: #f7f7fa;
  --md-sys-color-surface-container-high: #ecedf0;
  --md-sys-color-on-surface: #1c1b1f;
  --md-sys-color-on-surface-variant: #49454f;
  --md-sys-color-outline: #79747e;
  --md-sys-color-outline-variant: #cac4d0;
  
  /* MD3 Elevation */
  --md-sys-elevation-0: none;
  --md-sys-elevation-1: 0 1px 2px rgba(0,0,0,0.3), 0 1px 3px 1px rgba(0,0,0,0.15);
  --md-sys-elevation-2: 0 1px 2px rgba(0,0,0,0.3), 0 2px 6px 2px rgba(0,0,0,0.15);
  
  /* MD3 Shape */
  --md-sys-shape-corner-small: 8px;
  --md-sys-shape-corner-medium: 12px;
  --md-sys-shape-corner-large: 16px;
  --md-sys-shape-corner-extra-large: 28px;
  --md-sys-shape-corner-full: 9999px;
  
  /* MD3 Motion */
  --md-sys-motion-easing-standard: cubic-bezier(0.2, 0, 0, 1);
  --md-sys-motion-easing-emphasized: cubic-bezier(0.2, 0, 0, 1);
  --md-sys-motion-duration-short: 200ms;
  --md-sys-motion-duration-medium: 400ms;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  :root {
    --md-sys-color-primary: #6ee7b7;
    --md-sys-color-on-primary: #003822;
    --md-sys-color-surface: #1c1b1f;
    --md-sys-color-surface-container: #211f26;
    --md-sys-color-on-surface: #e6e1e5;
    --md-sys-color-outline: #938f99;
  }
}
```

---

## Phase 1: Shell

### Navigation Rail (Desktop Sidebar)

Replace the custom emerald sidebar with `<md-navigation-rail>`:
- Icons: Material Symbols (for chrome) + Phosphor (for domain-specific)
- Active indicator: MD3 pill shape with primary container color
- Collapsed: icon-only rail (80px)
- Expanded: rail with labels

### Navigation Bar (Mobile Bottom)

Replace BottomNav with `<md-navigation-bar>`:
- 5 destinations: Home, Map, Tasks, Calendar, Wiki
- Active indicator: MD3 pill
- Badge support for notification counts

### Top App Bar

Add `<md-top-app-bar>` to pages that need a title bar:
- Tasks: "Today" with weather/filter/settings action icons
- Map: none (map is full-screen)
- Calendar: month/year selector

---

## Phase 2: Tasks Module

### Smart List Cards → MD3 Cards

```html
<md-filled-card>
  <div class="card-content">
    <md-icon>today</md-icon>
    <span class="md-typescale-title-medium">Today</span>
    <span class="md-typescale-headline-small" style="color: var(--md-sys-color-primary)">3</span>
  </div>
</md-filled-card>
```

### Task Row → MD3 List Item

```html
<md-list-item>
  <md-checkbox slot="start" />
  <div slot="headline">Fix irrigation pump</div>
  <div slot="supporting-text">Tomorrow · Urgent · Block 3</div>
  <md-icon-button slot="end"><md-icon>more_vert</md-icon></md-icon-button>
</md-list-item>
```

### FAB → MD3 FAB

```html
<md-fab label="New Task" lowered>
  <md-icon slot="icon">add</md-icon>
</md-fab>
```

### Tags → MD3 Filter Chips

```html
<md-chip-set>
  <md-filter-chip label="Rooibos" selected></md-filter-chip>
  <md-filter-chip label="Crop Ops"></md-filter-chip>
</md-chip-set>
```

### Task Detail → MD3 Bottom Sheet

Replace FluidSheet with a proper MD3 bottom sheet pattern.

### Inline Add → MD3 Text Field

```html
<md-filled-text-field label="New task" placeholder="What needs to be done?">
  <md-icon slot="leading-icon">add_task</md-icon>
</md-filled-text-field>
```

---

## Phase 7: Dark Mode

With MD3 tokens set up in Phase 0, dark mode is mostly automatic:
- All component colors reference CSS custom properties
- `@media (prefers-color-scheme: dark)` overrides the properties
- MapLibre: switch to dark basemap style
- Tailwind: `bg-[var(--md-sys-color-surface)]` etc.

---

## Technical Notes

### @material/web + React

`@material/web` components are Lit-based web components. In React, use them directly as custom elements:

```tsx
// No wrapper needed — React 19 supports web component props natively
<md-filled-button onClick={handleSave}>Save</md-filled-button>
```

React 19+ passes properties to custom elements correctly. No `@lit-labs/react` wrapper needed.

### What Stays

- **Tailwind CSS** — layout utilities (flex, grid, spacing, responsive)
- **motion/react** — task completion springs, list animations
- **MapLibre GL** — map rendering (no MD3 equivalent)
- **@phosphor-icons/react** — domain-specific icons (farm, weather)
- **dnd-kit** — drag-and-drop (no MD3 equivalent)

### What Goes

- Custom glass-panel tokens (`.glass-panel`, `.glass-button`, `.glass-input`)
- Custom color variables (`--primary`, `--on-primary`, etc.) → replaced by MD3 tokens
- Hardcoded hex colors in components → replaced by `var(--md-sys-color-*)`
- Custom elevation/shadow patterns → replaced by MD3 elevation
- Duplicate `:root` blocks in index.css

---

## Success Criteria

- Every interactive element uses an MD3 component
- Light and dark mode work automatically
- No visual regression in functionality
- All 339+ tests still pass
- Lighthouse accessibility score >= 95
- Bundle size increase < 50KB gzipped
