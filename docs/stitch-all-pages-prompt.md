# Cloudskraal OS — Full Page Set for Google Stitch

Generate mobile-first (390×844) UI screens for a farm management OS. Use the same Material Design 3 aesthetic, color system, and component patterns from the Dashboard screen already generated. Every screen shares the same top bar (Cloudskraal logo + avatar) and bottom nav (Dashboard, Map, Calendar, Wiki, More).

## Shared Design System

- **Primary**: #005d42 (dark green), **Primary Container**: #047857
- **Secondary**: #712ae2 (violet), **Tertiary**: #7d4200 (amber)
- **Error**: #ba1a1a, **Surface**: #f9f9f8, **On-Surface**: #1a1c1c
- **Outline**: #6e7a73, **Outline-Variant**: #bdc9c1 at 15% opacity for borders
- **Cards**: White bg, rounded-xl, border 1px rgba(189,201,193,0.15)
- **Labels**: 10px, bold, uppercase, tracking-wider, color #6e7a73
- **Values**: 2xl, semibold, color #005d42
- **Font**: Inter, all weights
- **Icons**: Material Symbols Outlined
- **Bottom Nav**: 5 tabs (dashboard, map, calendar_month, menu_book, more_horiz), active = #047857 with /10 bg pill, rounded-t-2xl container
- **Top Bar**: h-16, Cloudskraal logo left, avatar right

Enterprise color coding used throughout:
- Rooibos = #047857 (green)
- Wine = #712ae2 (violet)
- Sheep = #d97706 (amber)
- Buchu = #0d9488 (teal)
- General = #6e7a73 (gray)

---

## Screen 1: Farm Map

Full-screen satellite map with colored field polygons. No padding, map fills entire viewport behind the top bar and above the bottom nav.

**Elements overlaying the map:**

Top-left floating card (rounded-xl, white, shadow-lg, p-3):
- Dropdown: "All Farms ▾" (options: Cloudskraal, Glenridge, Biekoes, Garsland, Meulsteenvlei, Kromvlei)
- Small filter icon button next to it

Top-right floating card:
- Layers icon button that indicates toggleable GIS overlays
- Below it: +/- zoom controls

Bottom-left floating card (small, semi-transparent white):
- Color legend dots: Green = Rooibos, Violet = Wine, Teal = Buchu, Amber = Sheep
- Checkbox: "— Farm Boundaries" with dashed line indicator

Right-side panel (when field selected, 400px on desktop, bottom sheet on mobile):
- Field name large, enterprise badge (green "rooibos" pill)
- Info grid: Farm, Code, Area (ha), Planted Year, Status, Irrigation
- Bar chart showing 20 years of production data (gray = estimated, green = actual yield in kg)
- Notes section
- "Add Note" button

The map itself shows: satellite imagery, ~100 green polygons (rooibos fields), a few violet polygons (vineyard), dashed gray outlines for farm boundaries with farm name labels (Cloudskraal 5,864 ha, Biekoes 517 ha, etc.)

---

## Screen 2: Calendar

Month view calendar with multi-day event bars, similar to Notion Calendar.

**Top bar area (below app bar):**
- Row of filter pills: Rooibos (green), Wine/Grapes (violet), Sheep/Grazing (amber), Buchu (teal), General (gray)
- Right side: "+ New Task" button (primary filled) + "+ New Event" button (outlined)

**Month grid:**
- Header: "< March 2026 >" with prev/next arrows
- 7-column grid (Mon–Sun), 5-6 rows
- Today (26th) highlighted with green ring
- Single-day events: small colored dots + truncated title text
- Multi-day events: colored horizontal bars spanning across cells (e.g., purple "Grape Harvest" bar spanning Mar 10-31, wrapping across weeks)
- Selected day has green background tint

**Right panel (desktop) / Bottom section (mobile):**
- Selected day header: "Thursday, 26 March 2026"
- Events list with colored dots + title
- Tasks list with priority color bar (left edge), title, enterprise badge, status pill
- Task type icons: clock (scheduled), zap (triggered), link (dependent)

**Drag interaction hint:** When user clicks and drags across multiple days, those cells highlight in green tint to create a date range selection.

---

## Screen 3: Wiki Home

Knowledge base listing page.

**Top area:**
- Large search input: "Search wiki..." with search icon, full width
- Right side: "Graph" button (with network icon) + "New Page" button (primary)

**Filter tabs (horizontal scroll):**
- All (active, filled primary bg), Enterprise Guide, Processing, Pest/Disease, Compliance, Equipment, Input Product, Farm Knowledge

**Page list grouped by category:**

Each category section:
- Section header: colored dot + "ENTERPRISE GUIDE (5)" — 10px uppercase bold, tracking-wider
- Page rows: title (text-sm font-bold), category badge (colored pill), enterprise badge (colored pill), comma-separated tags in gray, date on right
- Separator between sections

Example entries:
- "Rooibos Cultivation" — Enterprise Guide badge (green) + Rooibos badge + tags: cultivation, soil, harvest
- "Sheep Management" — Enterprise Guide badge + Sheep badge + tags: livestock, wool, breeding
- "Rooibos Processing" — Processing badge (blue) + Rooibos badge + tags: processing, workflow
- "Clear-wing Moth" — Pest/Disease badge (red) + Rooibos badge + tags: pest
- "FSSC 22000" — Compliance badge (violet) + tags: compliance, export

---

## Screen 4: Wiki Page View

Single wiki page with rendered content and sidebar.

**Breadcrumb:** "← Wiki > Enterprise Guide"

**Page header:**
- Title: "Rooibos Cultivation" (text-2xl font-bold)
- Badges: "Enterprise Guide" (green) + "Rooibos" (green)
- Tags: "cultivation" "soil" "harvest" (small gray pills)
- "Updated 26 Mar 2026" muted text
- "Edit" button (top-right, outlined)

**Content body (rendered markdown):**
- H2 headings: "Soil Requirements", "Planting", "Rotation & Rest", "Harvest", "Yield Benchmarks", "Climate"
- Body text with bold keywords
- Bullet lists
- Green dotted-underline links: "Soil Management", "Rooibos Processing" (wiki-links)
- Callout block: colored left-border box with icon — e.g., amber warning box with ⚠️ icon

**Right sidebar (desktop) / Below content (mobile):**
- "LINKS (6)" section — list of outgoing page links (clickable)
- "BACKLINKS (6)" section — list of pages that link TO this page

---

## Screen 5: Wiki Knowledge Graph

Dark-themed force-directed graph visualization.

**Background:** Near-black (#0c0a09)
**Top bar:** Dark (#1c1917), "← Wiki > Knowledge Graph" breadcrumb, "Click a node to open page" hint on right

**Graph area:**
- ~37 colored circular nodes of varying sizes connected by thin gray curved lines (~60 edges)
- Node colors match categories: Green = Enterprise, Blue = Processing, Red = Pest, Violet = Compliance, Amber = Equipment, Teal = Input, Gray = Knowledge
- Larger nodes have visible text labels: "Rooibos Cultivation", "Rooibos Processing", "Sheep Management", "FSSC 22000"
- Visible clusters: rooibos topics grouped together, sheep topics grouped, compliance topics grouped

**Legend (top-right, semi-transparent dark card):**
- Enterprise Guide (green dot)
- Processing (blue dot)
- Pest/Disease (red dot)
- Compliance (violet dot)
- Equipment (amber dot)
- Input Product (teal dot)
- Farm Knowledge (gray dot)
- "Scroll to zoom · Drag to pan" hint text

---

## Screen 6: Wiki Editor (Inline)

The same wiki page but in edit mode — content area becomes an editor.

**Page header:** Same as view mode but with editable title input, category dropdown, enterprise dropdown, tags text input

**Formatting toolbar (sticky, below header):**
- Icon buttons in a row: **B**, *I*, H1, H2, H3, link, callout, checklist, code, quote, divider
- Right side: "Preview" toggle button, "Cancel" button (outlined), "Save" button (primary filled)

**Editor area:**
- Full-width textarea showing raw markdown
- Clean monospace-ish font, good line spacing
- Content visible: `## Soil Requirements`, `**pH 4.2-4.7**`, `[[Soil Management]]`, `- **Sowing:** Feb-Mar`

**Slash command dropdown** (shown floating near cursor when "/" is typed):
- Grouped sections: Format (h1, h2, bold, italic), Blocks (callout, checklist, table), Database (field, equipment, task, wiki)
- Each item: icon + name + description/shortcut
- First item highlighted

---

## Screen 7: Equipment Register

**Header area:**
- "Equipment Register" title with wrench icon
- Summary stats (right): Total Items: 12, Total Value: R954,000, Overdue Service: 0

**Type filter tabs:** All (active), Processing (8), Tool (2), Tractor (1), Vehicle (1)

**Alert banner (yellow/amber):** "⚠ 1 item with overdue service: Toyota Hilux"

**Equipment table:**
- Columns: Name (bold, with code below in gray), Type (with emoji 🚜⚙️🚗🔧), Make/Model, Farm, Status (green "active" badge), Next Service date, Value
- 12 rows of equipment
- Clickable rows

**Detail panel (when row selected):**
- Equipment name, type badge, make/model, farm
- Info card with purchase price, current value, useful life, depreciation
- Maintenance log timeline: date, type badge (scheduled/breakdown), description, cost
- "Log Maintenance" button

---

## Screen 8: Livestock Tracker

**Dashboard row (4 cards):**
- Total Head: 665 (large number)
- Groups: 4
- Latest Shearing: 2,610 kg (with date "15 Sept 2025")
- Avg Micron: 19.5μ

**KPI row (4 cards, smaller):**
- Lambing %: 122% (green, "born / joined")
- Weaning %: 106.7% (green, "weaned / joined")
- Avg Wool/Head: 4.5 kg (neutral)
- Mortality Rate: 7% (red)

**Flock Groups section:**
- Grid of 4 cards, each showing: group name ("Breeding Ewes 2025"), breed ("merino"), head count large number (450), management type badge ("breeding" green / "trading" gray / "stud" blue)
- Expand chevron on each card

**Breeding Tracker:**
- Horizontal pipeline with 4 connected colored stages:
  - Joining (green): Dec 2025, 450 ewes, 15 rams
  - → Scanning (blue): Feb 2026, 410 pregnant, 40 dry
  - → Lambing (amber): May 2026, 550 born, 510 survived
  - → Weaning (green border, dashed): Sept 2026, 480 weaned
- Arrow connectors between stages
- "Weaning: 106.7%" badge prominently displayed
- Below: "Scan breakdown: Singles 280, Twins 120, Triplets 10"

**Shearing Records table:**
- Date, Group, Head, Total kg, Avg kg, Micron, Yield %, Buyer, Revenue

---

## Screen 9: Production Pipeline

Kanban board layout.

**Header:** "Production Pipeline" with factory icon
**Stats (top-right):** In Pipeline: 19,400 kg | Batches: 3 | Revenue: R954,000

**6 Kanban columns:**
- Received (gray dot, 0 batches) — "No batches" placeholder
- Processing (blue dot, 1) — card for BF-2026-002
- Graded (violet dot, 0) — "No batches"
- Stored (amber dot, 1) — card for BF-2026-001
- Sold (green dot, 1) — card for WC-2026-001
- Shipped (green dot, 0) — "No batches"

**Batch cards:**
- Batch code bold: "BF-2026-002"
- Product type + enterprise badge: "rooibos_oxidized" + green "rooibos" pill
- Quantity: "11,800 kg"
- If graded: quality badge ("Choice" in green)
- Latest step: "oxidation"
- Step count: "3 steps"

**Batch detail panel (when card clicked):**
- Batch info header with code, status badge, quantity
- Processing timeline (vertical): each step as a node — step type, start/end times, input→output kg, loss
- Quality test results table
- Sale info card with customer, quantity, unit price, total, payment status

---

## Screen 10: Employees

**Header:** "Employees" with people icon
**Stats (top-right):** Total: 4, Monthly Cost: R124,000, badge "permanent: 4"

**Filter tabs:** All (active), Permanent (4)

**Employee cards (grid, 1 col mobile, 3 col desktop):**
Each card:
- Name bold: "Japie Nel"
- Role: "Farm Manager"
- Department: "Management"
- Farm location: "Cloudskraal"
- Monthly salary: "R45,000/mo"
- Type badge: green "permanent" pill
- Expand chevron (reveals time entries table when clicked)

Expanded time entries table: Date, Hours, Activity, Enterprise

---

## Screen 11: Inventory

**Header:** "Inventory" with package icon
**Stats (top-right):** Products: 6, Stock Value: R196,500, Low Stock: 2

**Category filter tabs:** All, Fertilizer (2), Fuel (1), Herbicide (1), Pesticide (1), Seed (1)

**Alert banner (amber):** "⚠ 2 products with low stock: Agricultural Lime, Potassium Chloride (KCl)"

**Products table:**
- Product name (bold, with active ingredient subtitle in gray)
- Category badge (colored: green "fertilizer", dark "fuel", red "herbicide", amber "pesticide", teal "seed")
- Unit column
- Cost/Unit
- Stock level (amber "0 !" if low)
- Supplier

**Detail panel (when product selected):**
- Product name, category badge
- Info card: unit, cost/unit, supplier, active ingredients, withholding period
- Stock levels by location cards (location name, quantity, expiry date)
- "Purchase" button (green) + "Usage" button (amber)
- Transaction timeline: colored dots (green=purchase, amber=usage) with date, type badge, quantity, cost

---

## Screen 12: Financials

**Metric cards (3 across):**
- Total Revenue: R11,740,000 (green text)
- Total Expenses: R2,640,000 (red text)
- Net Income: R9,100,000 (primary text)

**Enterprise P&L visualization:**
- Horizontal bars per enterprise showing revenue (green) vs expenses (red)
- Enterprises: Rooibos (R6.1M rev), Wine/Grapes (R2M), Sheep/Wool (R1.6M), Interest (R2M)

**Transactions table:**
- Search input: "Search transactions..."
- Filter button with dropdown
- Table: Date, Description (with "Audited financials" subtitle), Enterprise badge, Category, Type badge (green "revenue" / red "expense"), Amount (green positive / red negative in ZAR)

Example rows:
- 31 Dec 2025 | Rooibos sales FY2025 | Rooibos | Sales | revenue | +R6,100,000
- 31 Dec 2025 | Employee costs FY2025 | – | Employee costs | expense | -R1,200,000

---

## Screen 13: CapEx Projects List

**Metric cards (4 across):**
- Total Projects: 22
- Total Budget: R35.5M
- Average IRR: 24.1%
- Best NPV: R7.4M (Meulsteenvlei)

**Filter tabs:** All Types, All Statuses, All Priorities

**Projects table:**
- Name (bold) with priority badge next to it: red "Must-do 2026", blue "Should-do", gray "Nice-to-have"
- Type column
- Initial Outlay (ZAR formatted)
- Status badge (green "approved", amber "evaluating", gray "draft")
- Best NPV (green if positive, red if negative)
- Best IRR (percentage)

---

## Screen 14: Cmd+K Command Palette

Overlay on top of any screen.

**Backdrop:** Blurred, darkened
**Modal:** Centered, max-width 480px, white, rounded-2xl, shadow-2xl

**Search input:** Large (text-lg), full width, search icon left, "Search Cloudskraal OS..." placeholder, "Esc" hint right

**Results below (grouped):**

NAVIGATION section:
- Dashboard (with home icon)
- Farm Map (map icon)
- Calendar (calendar icon)
- Wiki (book icon)
- Equipment (wrench icon)
- ...etc

WIKI PAGES section (when searching "rooibos"):
- Rooibos Cultivation — "enterprise" subtitle, "rooibos" tag right
- Rooibos Looper — "pest" subtitle
- Rooibos Processing — "process" subtitle

FIELDS section:
- B10: Ramkamp — "Biekoes" subtitle, "15.96 ha" right
- B12: Langs Tuin — "Biekoes", "11.8 ha"

TASKS section:
- Service Bovic cutters — "rooibos" tag

**Footer:** "↑↓ navigate · ↵ open · Esc close"

**Selected item:** Light green highlight (#047857/5%)

---

## Screen 15: Slash Command Menu

Small floating dropdown inside the wiki editor, appearing when "/" is typed.

**Container:** White, rounded-xl, shadow-xl, border, max-width 280px, max-height 320px

**Sections:**

FORMAT:
- /h1 — "Heading 1" — # icon
- /h2 — "Heading 2" — ## icon
- /bold — "Bold" — B icon
- /italic — "Italic" — I icon

BLOCKS:
- /callout — "Callout Note" — info icon
- /warning — "Warning" — warning icon
- /checklist — "Checklist" — checkbox icon
- /table — "Table" — grid icon
- /divider — "Divider" — minus icon

DATABASE:
- /field — "Link to field" — map pin icon — "Search 109 fields..."
- /equipment — "Link to equipment" — wrench icon
- /task — "Link to task" — checkbox icon
- /wiki — "Link to wiki page" — book icon

Each item: icon + command name + description on right, hover/selected = light green bg

---

Generate all 15 screens as mobile-first (390×844) designs, maintaining perfect visual consistency across all screens. Use the exact same header bar, bottom navigation, card styling, badge system, and typography from the Dashboard design already created.
