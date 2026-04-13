# Decision Forge — Design Document

**Date:** 2026-04-13
**Status:** Approved for implementation planning
**Author:** Alex (with Claude)

## 1. Summary

**Decision Forge** is a personal desktop decision gym combining Monte Carlo simulation, AI-powered negotiation rehearsal, and calibrated forecasting, built around a game-feel interactive UI. Single-user, local-first, Electron + React + Python sidecar.

## 2. Motivation

Alex needs a practical decision-support tool for real business/investment decisions (mineral trading, Cloudskraal agriculture, BSEC partnership negotiations). Research into decision-making techniques (three parallel agents, 2026-04-13) converged on a clear signal: **complex strategic-forecasting models (Mesquita EU, Nash solvers, full Bayesian networks) underperform disciplined use of simpler techniques** for single decision-makers. The highest-ROI stack is Monte Carlo + calibrated Bayesian updating (Tetlock-style) + BATNA discipline.

The tool deliberately rejects academic-favourite models in favour of techniques with documented practitioner track records, wrapped in a UI that makes using them feel like play rather than homework.

## 3. v1 Scope

Three tightly integrated modules:

1. **Monte Carlo Sandbox** — distribution-based input modelling and outcome simulation
2. **Negotiation Dojo** — multi-agent LLM negotiation rehearsal with BATNAs, personas, and Nash-bargaining debriefs
3. **Forecast Journal** — Brier-scored calibration practice on real-life predictions

### Out of scope for v1

Decision trees, Shapley value calculators, stakeholder maps, Nash equilibrium solvers, auction bid shaders, multi-user/cloud sync, mobile/web versions, installer/distribution, plug-in system, Excel import, local-LLM support, agent fine-tuning.

## 4. Architecture

### 4.1 Three-process model

```
┌─────────────────────────────────────────────────────────┐
│                 Electron Renderer (React)               │
│   ┌────────────┐ ┌──────────────┐ ┌─────────────────┐   │
│   │ MC Sandbox │ │ Nego. Dojo   │ │ Forecast Journal│   │
│   └────────────┘ └──────────────┘ └─────────────────┘   │
│   3D (react-three-fiber) · Tailwind · Framer Motion     │
└─────────────────────────────────────────────────────────┘
                           │ HTTP + SSE
                           ▼
┌─────────────────────────────────────────────────────────┐
│         Python Sidecar (FastAPI, uvicorn)               │
│   /mc/*    /nego/*    /forecast/*                       │
│   numpy · scipy · pymc · chaospy · salib · anthropic    │
└─────────────────────────────────────────────────────────┘
           │                                  │
           ▼                                  ▼
   SQLite (forecasts,          JSON files (scenarios,
   resolutions, Brier          negotiation transcripts)
   history)                    under ~/DecisionForge/
                                     │
                                     ▼ (Nego Dojo only)
                              Anthropic API
                              (claude-sonnet-4-6 default,
                               claude-haiku-4-5 cheap-mode)
```

- **Electron main** — window mgmt, IPC, spawns/supervises Python sidecar, secures Anthropic API key via OS keychain
- **Python sidecar** — all math (MC, Bayesian updating, Brier, Nash bargaining); owns LLM calls
- **Renderer** — React + react-three-fiber; communicates with sidecar via `http://localhost:<port>` and SSE for live streams

### 4.2 Why this split

- Python for math leverages mature ecosystem (`numpy`, `scipy`, `pymc`, `chaospy`, `salib`) — none of these have TypeScript equivalents of comparable quality.
- FastAPI sidecar gives auto-generated OpenAPI docs, usable from CLI and future scripts.
- Electron + React gives a proven stack (matching Dhando Analyzer) and access to `react-three-fiber` for the 3D visualisations that are central to the game-feel UX.
- Server-Sent Events (SSE) rather than WebSocket — one-way live streams (agent turns, particle-stream progress) are sufficient; user actions go through plain HTTP POST. Simpler to build and debug.

### 4.3 Monorepo layout

```
decision-forge/
├─ packages/
│  ├─ core/          # TypeScript types, Zod schemas shared by desktop + cli
│  ├─ py-engine/     # FastAPI app + math modules + Anthropic client
│  ├─ desktop/       # Electron main + React renderer + R3F scenes
│  └─ cli/           # CLI for batch MC runs, forecast entry, headless nego
├─ pnpm-workspace.yaml
├─ turbo.json
└─ package.json
```

Matches Dhando Analyzer conventions: pnpm + turbo, TypeScript 5.7, Electron 34, Vite 6, React 18, Tailwind 3, better-sqlite3. Python side uses Python 3.12, FastAPI, uvicorn, and the Anthropic SDK.

## 5. Data Model

### 5.1 Scenario (central concept)

```ts
type Scenario = {
  id: string                  // uuid
  name: string
  created: ISO8601
  tags: string[]              // "mining", "cloudskraal", "bsec"
  description: string
  modules: {
    monteCarlo?: MCConfig
    negotiation?: NegoConfig
    forecast?: ForecastLink
  }
  runs: ScenarioRun[]
}

type ScenarioRun = {
  id: string
  scenarioId: string
  timestamp: ISO8601
  module: "mc" | "negotiation"
  config: unknown             // immutable snapshot of config at run time
  result: unknown
  notes: string
}
```

### 5.2 Storage split

- **JSON files** — `~/DecisionForge/scenarios/<id>.json` (scenario + embedded runs). Portable, git-friendly, shareable.
- **SQLite** — `~/DecisionForge/forecasts.db` (questions, predictions, resolutions, Brier history). Time-series-queryable.

### 5.3 Rationale

Scenarios are documents: authored, versioned, shared. Forecasts are a growing time-series: queried, aggregated, scored. Different access patterns, different stores. Keeping them separate means the forecast journal remains useful even without a tied-in scenario (daily habit, not just deal-prep).

## 6. Module 1 — Monte Carlo Sandbox

### 6.1 Purpose

Define uncertain inputs as distributions, compose them into an outcome formula, see the distribution over outcomes.

### 6.2 Config schema

```ts
type MCConfig = {
  variables: MCVariable[]
  formula: string             // JS expression evaluated per iteration
  iterations: number          // default 10_000
}

type MCVariable = {
  name: string
  distribution:
    | { kind: "normal"; mean: number; sd: number }
    | { kind: "lognormal"; meanlog: number; sdlog: number }
    | { kind: "triangular"; min: number; mode: number; max: number }
    | { kind: "uniform"; min: number; max: number }
    | { kind: "pert"; min: number; mode: number; max: number }
    | { kind: "empirical"; samples: number[] }
  correlations?: { with: string; rho: number }[]
}
```

### 6.3 Endpoints

- `POST /mc/run` → `{ samples: number[]; stats: MCStats }`
- `POST /mc/sensitivity` → Sobol indices per variable (via `salib`)
- `GET /mc/stream/<run_id>` (SSE) → particle-stream progress for the 3D viz

### 6.4 UI

- **Left panel:** variable cards. Each card has a live mini-histogram; drag sliders to reshape distribution in real time.
- **Center:** 3D "particle cloud" (react-three-fiber). Each iteration is a particle positioned by outcome; press **Play** and particles stream in with easing, settling into the final distribution. Drag camera; optional sound ping per 1000 particles.
- **Right panel:** stats (mean, P10/P50/P90, P(outcome > X)), Sobol sensitivity tornado.
- **Compare mode:** overlay two scenarios as two colored clouds in the same 3D space.

### 6.5 Integration hooks

- "Log forecast from P90" button feeds a selection into the Forecast Journal.
- MC distributions can be referenced by name in Negotiation Dojo seat BATNAs (so agent BATNAs are sampled per run).

## 7. Module 2 — Negotiation Dojo

### 7.1 Purpose

Rehearse a real negotiation by having LLM agents play counterparties with private BATNAs, utilities, and personalities. User watches or plays a seat.

### 7.2 Config schema

```ts
type NegoConfig = {
  issues: NegoIssue[]
  seats: NegoSeat[]           // 2 to 4 players
  rounds: {
    maxRounds: number         // default 10
    protocol: "alternating-offers" | "simultaneous" | "free-form"
    discountFactor: number    // 0.9..1.0
  }
  stopConditions: {
    acceptanceThreshold: number   // utility % above BATNA to accept
    walkAway: boolean
  }
}

type NegoIssue = {
  name: string                // "price_per_ton", "volume", "payment_terms"
  type: "continuous" | "discrete"
  range?: [number, number]
  options?: string[]
  yourWeight: number          // 0..1 salience to the user
}

type NegoSeat = {
  id: string
  label: string               // "Buyer", "Supplier A"
  controlledBy: "you" | "ai"
  private: {                  // hidden from other seats
    batna: number | { refMCVar: string }   // point value OR MC-sampled
    reservationPrice: number
    utilityFn: { issue: string; weight: number; shape?: "linear" | "concave" }[]
    info: string
  }
  persona?: {                 // only if AI
    style: "hardball" | "collaborative" | "risk-averse" | "analytical" | "emotional"
    patience: number          // 0..1
    deceptiveness: number     // 0..1
    model: "claude-sonnet-4-6" | "claude-haiku-4-5"
    customPrompt?: string
  }
}
```

### 7.3 Turn loop

Python orchestrates; for each round, cycle seats in turn order. For a human-controlled seat, the loop awaits user action via HTTP POST. For an AI seat, Python constructs a per-agent context (persona prompt + private state + public transcript) and calls the Anthropic SDK with tools. Only tool calls are accepted: `make_offer`, `accept`, `reject`, `walk`, `ask_question`. Free-text "speech" is captured alongside the tool call for realism and replay. State updates are broadcast over SSE to the UI after each action. The loop exits when a deal is reached, everyone walks, or `maxRounds` is hit. After termination, the engine computes a Nash bargaining reference and per-seat utility vs BATNA for the debrief.

### 7.4 Endpoints

- `POST /nego/start` → `{ session_id }`
- `GET /nego/stream/<session_id>` (SSE) → live state updates
- `POST /nego/seat/<seat_id>/action` → submit move (if human-controlled)
- `POST /nego/resume/<session_id>` → continue a saved session
- `GET /nego/debrief/<session_id>` → Nash ref, utility breakdown, transcript

### 7.5 UI

- **3D "negotiation table":** seats arrayed around a table. Each seat has a floating utility gauge (only visible for seats you control, or after post-deal reveal). Offers appear as tokens sliding across the table.
- **Timeline scrubber:** replay any past round.
- **Live thought bubbles:** optional reasoning trace from each agent (truncated, animated typing).
- **ZOPA visualisation:** once all BATNAs are set, a translucent agreement zone is drawn over issue axes; offers are dots inside or outside.
- **Round clock:** ticking timer; discount factor visualised as "value pie" shrinking per round.
- **Post-deal debrief:** Nash bargaining solution overlay ("fair split was X, you got Y"), each seat's final utility vs BATNA, what-if replay buttons.

### 7.6 Anthropic cost & model selection

Default: `claude-sonnet-4-6` for all agents. A 10-round 3-agent session ≈ 30–60 API calls, ~$0.30–$0.80. Per-seat "cheap mode" (`claude-haiku-4-5`) is selectable for non-critical agents or exploratory runs.

### 7.7 Security

Anthropic API key stored via OS keychain (`keytar` in Electron main); never touches renderer or JSON files. Python sidecar receives the key from Electron main at spawn time via an environment variable. If the key is missing, Nego Dojo features are disabled with a clear prompt to configure.

## 8. Module 3 — Forecast Journal

### 8.1 Purpose

The compounding edge. Log predictions, resolve over time, score calibration (Brier score + calibration plot).

### 8.2 SQLite schema

```sql
CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolve_by TEXT NOT NULL,
  resolution_criteria TEXT,
  scenario_id TEXT,             -- nullable link to a Scenario
  tags TEXT                     -- JSON array
);

CREATE TABLE predictions (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(id),
  probability REAL NOT NULL,    -- 0..1
  made_at TEXT NOT NULL,
  rationale TEXT,
  confidence TEXT               -- "low" | "medium" | "high"
);

CREATE TABLE resolutions (
  question_id TEXT PRIMARY KEY REFERENCES questions(id),
  outcome INTEGER,              -- 0 or 1 (extendable to numeric later)
  resolved_at TEXT NOT NULL,
  notes TEXT
);
```

### 8.3 Endpoints

- `POST /forecast/question`, `POST /forecast/predict`, `POST /forecast/resolve`
- `GET /forecast/calibration?tags=...&from=...&to=...` → aggregated stats
  (calibration buckets, Brier, resolution, reliability decomposition)

### 8.4 UI

- **Question list** — filterable by tag, status (open/resolved), resolve-by date.
- **Ask mode** — enter question, tag, resolve-by date, criteria, initial probability + rationale.
- **Update mode** — add new probability (builds update trail; animated timeline shows belief evolution).
- **Resolve mode** — mark outcome, auto-compute Brier contribution.
- **Calibration dashboard** — calibration plot (predicted % vs actual %), Brier over time (rolling 30-day), reliability decomposition, tag-filtered breakdowns, streak badges.

### 8.5 Game-feel touches

- **Daily review prompt** on app launch — flags questions with passed resolve-by dates; resolve-or-extend in one click.
- **Prediction-made animation** — probability locks in with a "commit" pulse.
- Calibration dashboard is chart-heavy but animated (Framer Motion transitions), not a 3D centerpiece.

## 9. Cross-module Integration

Scenarios tie the three modules together:

- **MC → Nego:** a seat's `batna` can reference an MC variable (`{ refMCVar: "rand_zar_2027" }`); per-run BATNA is sampled from that distribution, so each Nego Dojo run plays differently.
- **Nego → Forecast:** post-debrief, one-click "log prediction" (e.g., "P(real deal closes within 5% of simulated outcome) = ?").
- **MC → Forecast:** one-click "log forecast from P90" pulls a threshold from the MC distribution.
- **Shared tags:** filter the calibration dashboard by tag to see per-domain calibration (e.g., "mining" vs "fx" vs "cloudskraal").

## 10. Visual & Interaction Design

Direction locked in brainstorming:

- **Chrome:** elegant, Linear/Stripe-quality polish — generous whitespace, refined typography, subtle motion (Framer Motion).
- **Centerpieces:** 3D interactive (react-three-fiber) — particle cloud for MC, negotiation table for Nego Dojo. Forecast Journal stays 2D but animated.
- **Game-feel:** all inputs are direct-manipulation wherever plausible (drag sliders reshape distributions live; drag offers onto the negotiation table; scrub timelines). Press **Play** to run simulations; sounds and animated transitions reinforce the "commit" moments.
- **Dark theme default**, with an accent color per module for instant orientation.

## 11. Tech Stack Summary

| Layer | Choice | Notes |
|---|---|---|
| Monorepo | pnpm + turbo | matches Dhando |
| Language (UI) | TypeScript 5.7 | strict mode |
| UI framework | React 18 + Vite 6 | matches Dhando |
| Desktop shell | Electron 34 | matches Dhando |
| Styling | Tailwind 3 | + Framer Motion |
| 3D | react-three-fiber | + drei helpers |
| Math engine | Python 3.12 | FastAPI + uvicorn |
| Math libs | numpy, scipy, pymc, chaospy, salib | |
| LLM | Anthropic SDK (Python) | sonnet-4-6 default, haiku-4-5 cheap mode |
| Persistence | better-sqlite3 + JSON files | split rationale in §5.2 |
| IPC | HTTP (localhost) + SSE | no WebSocket |
| Secrets | keytar (OS keychain) | Anthropic key |

## 12. Testing Approach

- **py-engine:** pytest. Pure math functions unit-tested against known distributions, analytical solutions (Nash bargaining closed-form for 2-player, Brier score on synthetic data). Endpoint tests via `httpx.AsyncClient`.
- **core:** vitest. Zod schema roundtrip tests.
- **desktop:** vitest for hooks/state, Playwright for critical user flows (MC run start-to-stats, negotiation session end-to-end, forecast entry + resolve).
- **Integration:** end-to-end test that spawns the real py-engine, runs a small MC, asserts result shape and statistics.

Explicitly not tested:

- 3D visuals (visual review only).
- LLM agent "quality" — judged indirectly by whether debrief calibration tracks reality over time.

## 13. Open Questions

None blocking. These are deferred to implementation planning:

- Exact port selection strategy for sidecar (fixed dev, ephemeral prod with handshake?)
- Whether to ship a seed library of example scenarios (Cloudskraal-style, BSEC-style) for onboarding
- Sound design specifics (asset sourcing, volume control, mute toggle — all deferred)

## 14. References

- Tetlock, *Superforecasting: The Art and Science of Prediction* (Good Judgment Project findings)
- Hubbard, *How to Measure Anything* (Monte Carlo effectiveness)
- Fisher & Ury, *Getting to Yes* (BATNA discipline)
- Nash, *The Bargaining Problem* (1950) (bargaining solution reference)
- Internal research 2026-04-13 (three parallel agents) on practitioner track records of prediction / game theory / probabilistic methods
- Dhando Analyzer (`/Users/alexnelja/projects/dhando-analyzer`) for stack conventions and monorepo layout
