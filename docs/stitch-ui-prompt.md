# Cloudskraal OS — UI Generation Prompt for Google Stitch

## App Overview

Build a modern, clean farm management OS called "Cloudskraal OS" for a South African rooibos tea, wine, and sheep farming operation. The app has 11 modules accessed via a sidebar (desktop) and bottom tabs (mobile). The design language is professional agricultural SaaS — not playful, not corporate. Think Notion meets fieldmargin meets a Bloomberg terminal for farming.

## Design System

- **Colors**: Emerald-800 sidebar (#065f46), emerald-700 primary (#047857), stone-50 background (#fafaf9), stone-800 text (#1c1917), white cards with stone-200 borders
- **Enterprise colors**: Rooibos = emerald (#047857), Wine = violet (#7c3aed), Sheep = amber (#d97706), Buchu = teal (#0d9488)
- **Typography**: System font stack, semibold headings, text-sm for most content
- **Cards**: White bg, rounded-xl, border stone-200, shadow-sm
- **Badges**: Rounded-full pills with enterprise or status colors
- **Buttons**: Emerald-700 primary, stone-100 secondary, rounded-lg
- **Icons**: Lucide icon set (thin line style)
- **Spacing**: Consistent p-4/p-5 card padding, gap-4 between cards

## Navigation

**Desktop sidebar (left, 256px, emerald-800 dark green):**
- Logo: Wheat icon + "Cloudskraal" + "Boerderye" subtitle
- Nav items with icons: Dashboard, Farm Map, Calendar, Wiki, Equipment, Livestock, Production, Employees, Inventory, Financials, CapEx, Compare
- Active item: emerald-700 bg
- Collapsible with chevron

**Mobile (bottom tab bar, 5 tabs):**
- Dashboard, Map, Calendar, Wiki, More
- Active: emerald-700 text, inactive: stone-400

## Screen 1: Dashboard (Operational Command Center)

The home screen. Shows the operational state of the farm at a glance.

**Layout**: Full width with sidebar offset. Scrollable.

**Row 1 — Metric Cards (4 across)**:
- Total Projects: 22
- Total CapEx Budget: R 35.5M
- Average IRR: 24.1%
- Best NPV Project: R 7.4M (Meulsteenvlei Purchase)

**Row 2 — Charts (2 columns)**:
- Left: "Budget by Type" horizontal bar chart (Land, Infrastructure, Other, Storage, Solar, Livestock, Irrigation, Equipment)
- Right: "Top 10 NPV Ranking" horizontal bar chart with color-coded bars by project type

**Row 3 — Tier Summary (3 columns)**:
- "Must-do 2026" card (red border): R13.3M budget, R13.7M NPV, 5 projects listed
- "Should-do 2026-27" card (blue border): R4.0M budget, R5.2M NPV, 4 projects
- "Nice-to-have" card (gray border): R18.2M budget, R13.8M NPV, 13 projects

**Row 4 — Upcoming Tasks**:
- White card with "Upcoming Tasks" header + "View all in Calendar →" link
- Red alert banner: "2 overdue tasks" with task names
- Tasks grouped by day: "Wednesday, 01 Apr" → task rows with priority color bar, title, enterprise badge, status pill

**Row 5 — Recent Projects**:
- List of 5 projects with name, type, outlay, status badge (approved/evaluating/draft), NPV value

## Screen 2: Farm Map (Full Screen)

A satellite map showing farm fields colored by enterprise.

**Layout**: Full screen, no padding. Map fills available space.

**Map**: Satellite imagery (Esri) centered on -31.32, 19.02 (Nieuwoudtville, South Africa). Zoom level ~12.

**Field polygons**: 109 colored polygons on the map:
- Green fill (35% opacity) = rooibos fields
- Purple fill = wine/vineyard fields
- Teal fill = buchu fields
- Gray dashed outlines = farm boundaries (6 farms: Cloudskraal 5864ha, Biekoes 517ha, Glenridge 324ha, etc.)

**Floating controls (top-left)**:
- Farm zoom dropdown: "All Farms" / Cloudskraal / Glenridge / Biekoes / Garsland / Meulsteenvlei / Kromvlei
- Expand button for enterprise filter checkboxes
- Field search input

**Layer control (top-right)**: Layers icon that expands to show GIS overlay toggles (Soils, Rainfall, Vegetation, Geology, Elevation, Soil pH)

**Legend (bottom-left)**: Small card showing enterprise colors + "Farm Boundaries" checkbox with dashed line icon

**Field detail panel (right side, 400px)**: Slides in when a field is clicked:
- Field name, enterprise badge, area in ha
- Info grid: Farm, Code, Planted Year, Status, Irrigation
- 20-year production bar chart (estimated gray + actual green bars per year)
- Field notes section
- "Add Note" button

## Screen 3: Calendar

Notion Calendar-style month view with multi-day event bars.

**Layout**: Two-panel — calendar grid (left 60%) + day detail (right 40%)

**Top bar**: Enterprise filter pills (Rooibos, Wine/Grapes, Sheep/Grazing, Buchu, General) + "New Task" button (emerald) + "New Event" button (outline)

**Month grid**: 7-column Mon-Sun grid showing March 2026:
- Today highlighted with emerald ring
- Single-day events as colored dots with truncated titles
- Multi-day events as colored horizontal bars spanning across cells (e.g., "Grape Harvest" purple bar spanning Mar 10-31)
- Click a day to select it

**Right panel**: Shows selected day's events and tasks:
- Day header: "Thursday, 26 March 2026"
- Events section with colored dots
- Tasks section as list with priority left-border, title, enterprise badge, status

**Drag-select**: Visual indication of clicking and dragging across multiple days to create a new event (emerald highlight across selected cells)

## Screen 4: Wiki

Obsidian-style knowledge base with [[wiki-links]] and a knowledge graph.

**Wiki Home** (`/wiki`):
- Search bar at top with "Search wiki..." placeholder
- "Graph" button (top-right) and "New Page" button
- Category filter tabs: All, Enterprise Guide, Processing, Pest/Disease, Compliance, Equipment, Input Product, Farm Knowledge
- Page list grouped by category with colored section headers
- Each page row: title, category badge, enterprise badge, tags, date

**Wiki Page View** (`/wiki/rooibos-cultivation`):
- Breadcrumb: ← Wiki > Enterprise Guide
- Title: "Rooibos Cultivation" with Enterprise Guide + Rooibos badges
- Tags: cultivation, soil, harvest
- Rendered markdown body with:
  - Formatted headings, bold, lists
  - Green dotted-underline [[wiki-links]] (e.g., "Soil Management", "Rooibos Processing")
  - Callout blocks: `> [!warning]` rendered as amber left-bordered box, `> [!tip]` as green
- Right sidebar: "Links (6)" list of outgoing pages + "Backlinks (6)" list of pages linking here
- "Edit" button top-right

**Wiki Editor Mode** (inline, not modal):
- Same page layout but content area becomes a textarea
- Formatting toolbar above: B, I, H1, H2, H3, Link, Callout, Checklist, Code, Quote, Divider
- Preview / Cancel / Save buttons
- Category, Enterprise, Tags editable above the editor

**Knowledge Graph** (`/wiki/graph`):
- Dark background (stone-950)
- Force-directed graph with ~37 colored nodes and ~60 edges
- Node colors by category: green=Enterprise, blue=Processing, red=Pest, purple=Compliance, orange=Equipment, teal=Input, gray=Knowledge
- Node size proportional to link count
- Labels on larger nodes
- Category legend in top-right
- "← Wiki > Knowledge Graph" breadcrumb

## Screen 5: Equipment Register

**Header**: "Equipment Register" + summary stats (Total Items: 12, Total Value: R954,000, Overdue Service: 0)

**Type filter tabs**: All, Processing (8), Tool (2), Tractor (1), Vehicle (1)

**Alert banner** (yellow): "1 item with overdue service: Toyota Hilux"

**Table**: Name (with code below), Type (with emoji), Make/Model, Farm, Status (green "active" badge), Next Service date, Value (ZAR)

**Detail panel** (right side when row clicked): Equipment info card + maintenance log timeline

## Screen 6: Livestock Tracker

**Dashboard cards (4 across)**: Total Head: 665, Groups: 4, Latest Shearing: 2,610 kg, Avg Micron: 19.5μ

**KPI row (4 across)**: Lambing %: 122%, Weaning %: 106.7%, Avg Wool/Head: 4.5 kg, Mortality Rate: 7%

**Flock Groups**: Cards in a grid — each showing group name, breed, head count (large number), management type badge (breeding/trading/stud), expand chevron

**Breeding Tracker**: Horizontal pipeline visualization:
- 4 colored stages: Joining (green, Dec 2025, 450 ewes, 15 rams) → Scanning (blue, Feb 2026, 410 pregnant, 40 dry) → Lambing (amber, May 2026, 550 born, 510 survived) → Weaning (emerald, Sept 2026, 480 weaned)
- Arrow connectors between stages
- "Weaning: 106.7%" prominently displayed
- Scan breakdown: Singles 280, Twins 120, Triplets 10

**Shearing Records**: Table with date, group, head shorn, total kg, avg kg, micron, yield %, buyer, revenue

## Screen 7: Production Pipeline

**Layout**: Kanban board with 6 status columns

**Header stats (top-right)**: In Pipeline: 19,400 kg, Batches: 3, Revenue: R954,000

**Kanban columns**: Received (0) | Processing (1) | Graded (0) | Stored (1) | Sold (1) | Shipped (0)

Each column has a colored dot header. Batch cards show:
- Batch code (bold): "BF-2026-002"
- Product type + enterprise badge: "rooibos_oxidized" + green "rooibos" pill
- Quantity: "11,800 kg"
- Quality grade badge (if graded): green "Choice" pill
- Latest step: "oxidation"
- Step count: "3 steps"

## Screen 8: Employees

**Header**: "Employees" + Total: 4, Monthly Cost: R124,000 + type badge "permanent: 4"

**Filter tabs**: All, Permanent (4)

**Employee cards (grid)**: Each card shows:
- Name (bold)
- Role + Department
- Farm
- Monthly salary
- Type badge (green "permanent")
- Expand chevron for time entries

## Screen 9: Inventory

**Header**: "Inventory" + Products: 6, Stock Value: R196,500, Low Stock: 0

**Category filters**: All, Fertilizer (2), Fuel (1), Herbicide (1), Pesticide (1), Seed (1)

**Alert banner** (amber): "2 products with low stock: Agricultural Lime, Potassium Chloride"

**Table**: Product name (with active ingredient subtitle), Category badge (colored), Unit, Cost/Unit, Stock level (amber "0 !" if low), Supplier

**Detail panel**: Product info + stock by location + Purchase/Usage buttons + transaction timeline

## Screen 10: Financials

**Metric cards (3)**: Total Revenue: R11,740,000 (green), Total Expenses: R2,640,000 (red), Net Income: R9,100,000

**Enterprise P&L chart**: Horizontal bar chart showing revenue (green) vs expenses (red) per enterprise

**Transactions table**: Searchable, filterable table with Date, Description, Enterprise, Category, Type badge (green "revenue" / red "expense"), Amount (green positive / red negative)

## Screen 11: CapEx Evaluation

**Metric cards**: Total Projects: 22, Total Budget: R35.5M, Average IRR: 24.1%, Best NPV: R7.4M

**Projects table with priority badges**: Each row has a colored priority pill (red "Must-do 2026", blue "Should-do", gray "Nice-to-have") next to the project name. Columns: Name, Type, Initial Outlay, Status badge, Best NPV, Best IRR

**Project detail page**: Tabs (Overview, Cash Flows, Funding Scenarios)
- Overview: info card, tax benefit badge (green), scenario summary cards (NPV, IRR, Payback, WACC), NPV comparison bar chart
- Cash Flows: editable table with year, revenue, operating costs, net cash flow + cumulative line chart
- Scenarios: detailed scenario cards with debt/equity split, interest rate, loan term, computed metrics

## Global Features

**Cmd+K Command Palette**: Centered modal with backdrop blur, search input, results grouped by: Navigation, Wiki Pages, Fields, Equipment, Tasks. Each result has icon + title + subtitle. Keyboard navigable.

**Slash Commands**: In the wiki editor, typing "/" shows a dropdown menu with Format (h1, bold, italic), Blocks (callout, checklist, table), and Database (field, equipment, task, wiki) commands that search the live database.

## Responsive Behavior

- **Desktop (>768px)**: Left sidebar always visible, content offset 256px, side panels 400px
- **Mobile (<768px)**: No sidebar, bottom tab nav (5 tabs), full-width content, panels slide up from bottom as sheets (max 70vh), tables scroll horizontally, cards stack vertically
- **Map**: Full screen on all devices, controls float on top
- **Calendar**: Stacked layout on mobile (month grid top, day detail bottom)

## Data Context

This is a real farm management system for Cloudskraal Boerderye in the Nieuwoudtville region of South Africa. The data is real:
- 6 farms covering 8,184 hectares
- 109 agricultural fields (rooibos tea, wine grapes, buchu, sheep grazing)
- 20 years of rooibos production history per field
- 12 pieces of farm equipment worth R954,000
- 665 sheep across 4 flock groups
- 3 production batches (19,400 kg rooibos + wool)
- 4 permanent employees
- 6 input products in inventory
- R11.7M annual revenue across 5 enterprises
- 37 wiki knowledge base pages with 60 interconnecting links
- 15 seasonal calendar events synced to Google Calendar
- 22 capital expenditure projects evaluated with NPV/IRR analysis
