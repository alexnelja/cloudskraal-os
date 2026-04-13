# Decision Forge — Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a runnable Electron desktop app with a Python FastAPI sidecar, three empty module pages (MC Sandbox, Negotiation Dojo, Forecast Journal), shared TypeScript data-model package, and Scenario file I/O. End state: `pnpm dev` launches the app, three placeholder pages navigate cleanly, the sidecar responds to `/health`, scenarios save/load to `~/DecisionForge/scenarios/`.

**Architecture:** pnpm + turbo monorepo mirroring Dhando Analyzer. Packages: `core` (TS types + Zod schemas), `py-engine` (FastAPI), `desktop` (Electron main + React renderer), `cli` (minimal stub). Electron main spawns `py-engine` on launch, waits for `/health`, then opens the renderer. Renderer talks to sidecar via `http://localhost:<port>`. Scenarios persisted as JSON files under the user's home directory. Anthropic API key stored in the OS keychain via keytar (scaffolded; used in Plan 4).

**Tech Stack:** pnpm 9, turbo 2, TypeScript 5.7, Electron 34, Vite 6, React 18, react-router-dom 6, Tailwind 3, Framer Motion 11, Python 3.12, FastAPI, uvicorn, pytest, httpx, better-sqlite3 (scaffolded), keytar.

**Reference spec:** `docs/superpowers/specs/2026-04-13-decision-forge-design.md`

---

## File Structure

```
decision-forge/
├─ package.json                          # monorepo root
├─ pnpm-workspace.yaml
├─ turbo.json
├─ tsconfig.base.json
├─ .gitignore
├─ README.md
├─ packages/
│  ├─ core/
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  ├─ src/
│  │  │  ├─ index.ts                     # re-exports
│  │  │  ├─ schemas/
│  │  │  │  ├─ scenario.ts               # Zod schemas from spec §5
│  │  │  │  ├─ mc-config.ts              # (scaffolded, no runtime logic)
│  │  │  │  ├─ nego-config.ts            # (scaffolded)
│  │  │  │  └─ forecast.ts               # (scaffolded)
│  │  │  └─ paths.ts                     # app data dir resolver
│  │  └─ tests/
│  │     └─ scenario.test.ts
│  │
│  ├─ py-engine/
│  │  ├─ pyproject.toml
│  │  ├─ README.md
│  │  ├─ decision_forge/
│  │  │  ├─ __init__.py
│  │  │  ├─ app.py                       # FastAPI app factory
│  │  │  ├─ main.py                      # uvicorn entrypoint
│  │  │  ├─ config.py                    # settings (port, api key env var)
│  │  │  └─ routers/
│  │  │     ├─ __init__.py
│  │  │     └─ health.py                 # /health endpoint
│  │  └─ tests/
│  │     ├─ __init__.py
│  │     └─ test_health.py
│  │
│  ├─ desktop/
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  ├─ vite.config.ts
│  │  ├─ tailwind.config.js
│  │  ├─ postcss.config.js
│  │  ├─ index.html
│  │  ├─ src/
│  │  │  ├─ main/
│  │  │  │  ├─ index.ts                  # Electron app entry
│  │  │  │  ├─ sidecar.ts                # spawn + supervise py-engine
│  │  │  │  ├─ scenarios.ts              # file I/O (main process)
│  │  │  │  ├─ keychain.ts               # keytar wrapper (scaffolded)
│  │  │  │  └─ preload.ts                # contextBridge API
│  │  │  └─ renderer/
│  │  │     ├─ main.tsx                  # React entry
│  │  │     ├─ App.tsx                   # router + layout
│  │  │     ├─ index.css                 # Tailwind directives
│  │  │     ├─ lib/
│  │  │     │  ├─ sidecar-client.ts      # fetch helpers
│  │  │     │  └─ scenarios-api.ts       # window.api.scenarios wrapper
│  │  │     ├─ components/
│  │  │     │  ├─ Sidebar.tsx
│  │  │     │  └─ ModuleFrame.tsx
│  │  │     └─ pages/
│  │  │        ├─ Home.tsx
│  │  │        ├─ MonteCarlo.tsx         # placeholder
│  │  │        ├─ Negotiation.tsx        # placeholder
│  │  │        └─ Forecast.tsx           # placeholder
│  │  └─ tests/
│  │     ├─ renderer/
│  │     │  └─ App.test.tsx
│  │     └─ e2e/
│  │        └─ smoke.spec.ts
│  │
│  └─ cli/
│     ├─ package.json
│     ├─ src/index.ts                    # stub: "decision-forge <cmd>"
│     └─ tests/index.test.ts
```

---

## Conventions (applies to every task)

**Branch / worktree:** All work happens in `/Users/alexnelja/projects/decision-forge/`. This directory does not yet exist — Task 1 creates it. It is a **new standalone project**, not a branch of an existing repo.

**Commit message format:** `feat(scope): description` or `chore(scope): description` or `test(scope): description`, where scope is one of `core | py-engine | desktop | cli | repo`.

**Test discipline:** Every task writes the test first, runs to confirm FAIL, then implements, then runs to confirm PASS. No exceptions.

**DO NOT** add any feature not explicitly listed in a task. If a task seems to need something not there, stop and ask.

---

### Task 1: Initialize monorepo skeleton

**Goal:** Empty monorepo with pnpm workspace, turbo pipeline, base tsconfig, .gitignore, README. `pnpm install` succeeds with no workspaces.

**Files:**
- Create: `/Users/alexnelja/projects/decision-forge/package.json`
- Create: `/Users/alexnelja/projects/decision-forge/pnpm-workspace.yaml`
- Create: `/Users/alexnelja/projects/decision-forge/turbo.json`
- Create: `/Users/alexnelja/projects/decision-forge/tsconfig.base.json`
- Create: `/Users/alexnelja/projects/decision-forge/.gitignore`
- Create: `/Users/alexnelja/projects/decision-forge/README.md`

- [ ] **Step 1: Create directory and initialize git**

```bash
mkdir -p /Users/alexnelja/projects/decision-forge
cd /Users/alexnelja/projects/decision-forge
git init
```

- [ ] **Step 2: Write `.gitignore`**

```gitignore
node_modules/
dist/
.turbo/
*.log
.env
.env.local
.DS_Store
.vite/
playwright-report/
test-results/
__pycache__/
*.pyc
.venv/
.pytest_cache/
coverage/
```

- [ ] **Step 3: Write `package.json`**

```json
{
  "name": "decision-forge",
  "private": true,
  "scripts": {
    "build": "turbo build",
    "test": "turbo test",
    "dev": "turbo dev",
    "lint": "turbo lint",
    "clean": "turbo clean"
  },
  "devDependencies": {
    "turbo": "^2.4.0",
    "typescript": "^5.7.0"
  },
  "packageManager": "pnpm@9.15.0"
}
```

- [ ] **Step 4: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
```

- [ ] **Step 5: Write `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "test": { "dependsOn": ["^build"] },
    "dev": { "cache": false, "persistent": true },
    "lint": {},
    "clean": { "cache": false }
  }
}
```

- [ ] **Step 6: Write `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  }
}
```

- [ ] **Step 7: Write minimal `README.md`**

```markdown
# Decision Forge

Personal decision gym — Monte Carlo, AI negotiation, calibrated forecasting.

See `docs/superpowers/specs/2026-04-13-decision-forge-design.md` in the parent repo for the full design.

## Quick start

Pending Plan 1 completion.
```

- [ ] **Step 8: Run `pnpm install` to verify**

Run: `cd /Users/alexnelja/projects/decision-forge && pnpm install`
Expected: installs `turbo` and `typescript` at the root, creates `pnpm-lock.yaml`, no errors.

- [ ] **Step 9: Commit**

```bash
cd /Users/alexnelja/projects/decision-forge
git add -A
git commit -m "chore(repo): initialize pnpm/turbo monorepo skeleton"
```

---

### Task 2: Core package — Scenario Zod schema + paths helper

**Goal:** `@decision-forge/core` package with Zod schemas for `Scenario` and `ScenarioRun` (per spec §5.1), a `resolveAppDataDir()` helper, and passing roundtrip tests.

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/index.ts`
- Create: `packages/core/src/schemas/scenario.ts`
- Create: `packages/core/src/schemas/mc-config.ts` (exports `MCConfigSchema = z.unknown()` placeholder — Plan 3 fills in)
- Create: `packages/core/src/schemas/nego-config.ts` (same — Plan 4)
- Create: `packages/core/src/schemas/forecast.ts` (same — Plan 2)
- Create: `packages/core/src/paths.ts`
- Create: `packages/core/tests/scenario.test.ts`
- Create: `packages/core/tests/paths.test.ts`

- [ ] **Step 1: Write `packages/core/package.json`**

```json
{
  "name": "@decision-forge/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Write `packages/core/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "composite": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Write the failing test `packages/core/tests/scenario.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { ScenarioSchema } from "../src/schemas/scenario.js";

describe("ScenarioSchema", () => {
  it("parses a minimal valid scenario", () => {
    const input = {
      id: "11111111-1111-1111-1111-111111111111",
      name: "Test",
      created: "2026-04-13T10:00:00Z",
      tags: ["mining"],
      description: "",
      modules: {},
      runs: []
    };
    const parsed = ScenarioSchema.parse(input);
    expect(parsed.id).toBe(input.id);
    expect(parsed.tags).toEqual(["mining"]);
  });

  it("rejects a scenario with wrong id type", () => {
    expect(() =>
      ScenarioSchema.parse({
        id: 123,
        name: "x",
        created: "2026-04-13T10:00:00Z",
        tags: [],
        description: "",
        modules: {},
        runs: []
      })
    ).toThrow();
  });

  it("roundtrips through JSON", () => {
    const input = {
      id: "22222222-2222-2222-2222-222222222222",
      name: "Roundtrip",
      created: "2026-04-13T10:00:00Z",
      tags: ["bsec", "fx"],
      description: "multi-tag test",
      modules: {},
      runs: [
        {
          id: "33333333-3333-3333-3333-333333333333",
          scenarioId: "22222222-2222-2222-2222-222222222222",
          timestamp: "2026-04-13T10:05:00Z",
          module: "mc",
          config: { placeholder: true },
          result: { placeholder: true },
          notes: ""
        }
      ]
    };
    const parsed = ScenarioSchema.parse(JSON.parse(JSON.stringify(input)));
    expect(parsed).toEqual(input);
  });
});
```

- [ ] **Step 4: Install deps and run test to confirm FAIL**

```bash
cd /Users/alexnelja/projects/decision-forge
pnpm install
cd packages/core
pnpm test
```
Expected: FAIL — `schemas/scenario.ts` does not exist.

- [ ] **Step 5: Write scaffold schemas (placeholders for later plans)**

`packages/core/src/schemas/mc-config.ts`:
```ts
import { z } from "zod";
export const MCConfigSchema = z.unknown();
export type MCConfig = z.infer<typeof MCConfigSchema>;
```
`packages/core/src/schemas/nego-config.ts`:
```ts
import { z } from "zod";
export const NegoConfigSchema = z.unknown();
export type NegoConfig = z.infer<typeof NegoConfigSchema>;
```
`packages/core/src/schemas/forecast.ts`:
```ts
import { z } from "zod";
export const ForecastLinkSchema = z.unknown();
export type ForecastLink = z.infer<typeof ForecastLinkSchema>;
```

- [ ] **Step 6: Write `packages/core/src/schemas/scenario.ts`**

```ts
import { z } from "zod";
import { MCConfigSchema } from "./mc-config.js";
import { NegoConfigSchema } from "./nego-config.js";
import { ForecastLinkSchema } from "./forecast.js";

export const ScenarioRunSchema = z.object({
  id: z.string().uuid(),
  scenarioId: z.string().uuid(),
  timestamp: z.string().datetime(),
  module: z.enum(["mc", "negotiation"]),
  config: z.unknown(),
  result: z.unknown(),
  notes: z.string()
});
export type ScenarioRun = z.infer<typeof ScenarioRunSchema>;

export const ScenarioSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  created: z.string().datetime(),
  tags: z.array(z.string()),
  description: z.string(),
  modules: z.object({
    monteCarlo: MCConfigSchema.optional(),
    negotiation: NegoConfigSchema.optional(),
    forecast: ForecastLinkSchema.optional()
  }),
  runs: z.array(ScenarioRunSchema)
});
export type Scenario = z.infer<typeof ScenarioSchema>;
```

- [ ] **Step 7: Write `packages/core/src/paths.ts`**

```ts
import path from "node:path";
import os from "node:os";

export function resolveAppDataDir(override?: string): string {
  if (override) return override;
  return path.join(os.homedir(), "DecisionForge");
}

export function scenariosDir(override?: string): string {
  return path.join(resolveAppDataDir(override), "scenarios");
}

export function forecastsDbPath(override?: string): string {
  return path.join(resolveAppDataDir(override), "forecasts.db");
}
```

- [ ] **Step 8: Write `packages/core/tests/paths.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import path from "node:path";
import { resolveAppDataDir, scenariosDir, forecastsDbPath } from "../src/paths.js";

describe("paths", () => {
  it("returns override when provided", () => {
    expect(resolveAppDataDir("/tmp/df")).toBe("/tmp/df");
  });
  it("scenariosDir joins properly", () => {
    expect(scenariosDir("/tmp/df")).toBe(path.join("/tmp/df", "scenarios"));
  });
  it("forecastsDbPath joins properly", () => {
    expect(forecastsDbPath("/tmp/df")).toBe(path.join("/tmp/df", "forecasts.db"));
  });
});
```

- [ ] **Step 9: Write `packages/core/src/index.ts`**

```ts
export * from "./schemas/scenario.js";
export * from "./schemas/mc-config.js";
export * from "./schemas/nego-config.js";
export * from "./schemas/forecast.js";
export * from "./paths.js";
```

- [ ] **Step 10: Run tests and build**

```bash
cd /Users/alexnelja/projects/decision-forge/packages/core
pnpm install
pnpm test
pnpm build
```
Expected: all tests PASS, `dist/` contains `.js` and `.d.ts` files.

- [ ] **Step 11: Commit**

```bash
cd /Users/alexnelja/projects/decision-forge
git add -A
git commit -m "feat(core): Scenario Zod schemas and path helpers"
```

---

### Task 3: Python sidecar skeleton

**Goal:** `py-engine` package with FastAPI `/health` endpoint, a `uvicorn` entrypoint honoring `PORT` env var, and a pytest that hits `/health` via `httpx.AsyncClient`.

**Files:**
- Create: `packages/py-engine/pyproject.toml`
- Create: `packages/py-engine/README.md`
- Create: `packages/py-engine/decision_forge/__init__.py`
- Create: `packages/py-engine/decision_forge/app.py`
- Create: `packages/py-engine/decision_forge/main.py`
- Create: `packages/py-engine/decision_forge/config.py`
- Create: `packages/py-engine/decision_forge/routers/__init__.py`
- Create: `packages/py-engine/decision_forge/routers/health.py`
- Create: `packages/py-engine/tests/__init__.py`
- Create: `packages/py-engine/tests/test_health.py`

- [ ] **Step 1: Write `packages/py-engine/pyproject.toml`**

```toml
[project]
name = "decision-forge-engine"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
  "fastapi>=0.115.0",
  "uvicorn[standard]>=0.32.0",
  "pydantic>=2.9.0",
  "pydantic-settings>=2.5.0"
]

[project.optional-dependencies]
dev = [
  "pytest>=8.3.0",
  "pytest-asyncio>=0.24.0",
  "httpx>=0.27.0"
]

[project.scripts]
decision-forge-engine = "decision_forge.main:main"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.pytest.ini_options]
asyncio_mode = "auto"
```

- [ ] **Step 2: Write failing test `packages/py-engine/tests/test_health.py`**

```python
import pytest
from httpx import ASGITransport, AsyncClient
from decision_forge.app import create_app

@pytest.mark.asyncio
async def test_health_returns_ok():
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "version" in body
```

- [ ] **Step 3: Install and run test to confirm FAIL**

```bash
cd /Users/alexnelja/projects/decision-forge/packages/py-engine
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
pytest -v
```
Expected: FAIL — `decision_forge.app` does not exist.

- [ ] **Step 4: Write `decision_forge/__init__.py`**

```python
__version__ = "0.1.0"
```

- [ ] **Step 5: Write `decision_forge/config.py`**

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    port: int = 8765
    anthropic_api_key: str | None = None

    class Config:
        env_prefix = "DECISION_FORGE_"

settings = Settings()
```

- [ ] **Step 6: Write `decision_forge/routers/__init__.py`** (empty file)

- [ ] **Step 7: Write `decision_forge/routers/health.py`**

```python
from fastapi import APIRouter
from decision_forge import __version__

router = APIRouter()

@router.get("/health")
async def health() -> dict:
    return {"status": "ok", "version": __version__}
```

- [ ] **Step 8: Write `decision_forge/app.py`**

```python
from fastapi import FastAPI
from decision_forge.routers import health

def create_app() -> FastAPI:
    app = FastAPI(title="Decision Forge Engine", version="0.1.0")
    app.include_router(health.router)
    return app
```

- [ ] **Step 9: Write `decision_forge/main.py`**

```python
import uvicorn
from decision_forge.config import settings

def main() -> None:
    uvicorn.run(
        "decision_forge.app:create_app",
        host="127.0.0.1",
        port=settings.port,
        factory=True,
        log_level="info",
    )

if __name__ == "__main__":
    main()
```

- [ ] **Step 10: Write `tests/__init__.py`** (empty file)

- [ ] **Step 11: Run test to confirm PASS**

```bash
cd /Users/alexnelja/projects/decision-forge/packages/py-engine
pytest -v
```
Expected: PASS.

- [ ] **Step 12: Smoke-test the server manually**

```bash
cd /Users/alexnelja/projects/decision-forge/packages/py-engine
DECISION_FORGE_PORT=8765 decision-forge-engine &
PID=$!
sleep 2
curl -s http://127.0.0.1:8765/health
kill $PID
```
Expected: JSON `{"status":"ok","version":"0.1.0"}`.

- [ ] **Step 13: Write minimal `README.md`**

```markdown
# Decision Forge — Python Engine

FastAPI sidecar. See parent design doc.

## Dev
```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
pytest
decision-forge-engine
```
```

- [ ] **Step 14: Commit**

```bash
cd /Users/alexnelja/projects/decision-forge
git add -A
git commit -m "feat(py-engine): FastAPI skeleton with /health endpoint"
```

---

### Task 4: Desktop package skeleton — Electron main + sidecar supervisor

**Goal:** Electron main process that (a) spawns the Python sidecar, (b) waits for `/health` to return 200, (c) opens a BrowserWindow. Handles graceful shutdown of the sidecar on app quit. Stub preload script exposes `window.api.sidecarUrl()`.

**Files:**
- Create: `packages/desktop/package.json`
- Create: `packages/desktop/tsconfig.json`
- Create: `packages/desktop/src/main/index.ts`
- Create: `packages/desktop/src/main/sidecar.ts`
- Create: `packages/desktop/src/main/preload.ts`
- Create: `packages/desktop/src/main/scenarios.ts` (stub — Task 7 fleshes out)
- Create: `packages/desktop/src/main/keychain.ts` (stub — Plan 4 fleshes out)
- Create: `packages/desktop/tests/main/sidecar.test.ts`

- [ ] **Step 1: Write `packages/desktop/package.json`**

```json
{
  "name": "@decision-forge/desktop",
  "version": "0.1.0",
  "private": true,
  "main": "dist/main/index.js",
  "scripts": {
    "build:main": "esbuild src/main/index.ts --bundle --platform=node --outfile=dist/main/index.js --external:electron --external:better-sqlite3 --external:keytar && esbuild src/main/preload.ts --bundle --platform=node --outfile=dist/main/preload.js --external:electron",
    "build:renderer": "vite build",
    "build": "pnpm build:main && pnpm build:renderer",
    "dev": "pnpm build:main && concurrently \"vite\" \"wait-on http://localhost:5273 && electron .\"",
    "electron": "electron .",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@decision-forge/core": "workspace:*",
    "keytar": "^7.9.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.28.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "concurrently": "^9.0.0",
    "electron": "^34.0.0",
    "esbuild": "^0.24.2",
    "framer-motion": "^11.11.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0",
    "wait-on": "^8.0.0"
  }
}
```

- [ ] **Step 2: Write `packages/desktop/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["node", "vite/client"]
  },
  "include": ["src/**/*", "tests/**/*"],
  "references": [{ "path": "../core" }]
}
```

- [ ] **Step 3: Write failing test `packages/desktop/tests/main/sidecar.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";
import { waitForHealth } from "../../src/main/sidecar.js";

describe("waitForHealth", () => {
  it("resolves when /health returns 200", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "ok" }), { status: 200 })
    );
    await waitForHealth("http://127.0.0.1:8765", {
      timeoutMs: 1000,
      intervalMs: 10,
      fetchImpl: fetchMock as unknown as typeof fetch
    });
    expect(fetchMock).toHaveBeenCalled();
  });

  it("rejects after timeout", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(
      waitForHealth("http://127.0.0.1:1", {
        timeoutMs: 50,
        intervalMs: 10,
        fetchImpl: fetchMock as unknown as typeof fetch
      })
    ).rejects.toThrow(/timeout/i);
  });
});
```

- [ ] **Step 4: Run test to confirm FAIL**

```bash
cd /Users/alexnelja/projects/decision-forge
pnpm install
cd packages/desktop
pnpm test
```
Expected: FAIL — module does not exist.

- [ ] **Step 5: Write `packages/desktop/src/main/sidecar.ts`**

```ts
import { spawn, ChildProcess } from "node:child_process";
import path from "node:path";

export interface WaitForHealthOptions {
  timeoutMs: number;
  intervalMs: number;
  fetchImpl?: typeof fetch;
}

export async function waitForHealth(
  baseUrl: string,
  opts: WaitForHealthOptions
): Promise<void> {
  const f = opts.fetchImpl ?? fetch;
  const start = Date.now();
  while (Date.now() - start < opts.timeoutMs) {
    try {
      const resp = await f(`${baseUrl}/health`);
      if (resp.status === 200) return;
    } catch {
      // ignore and retry
    }
    await new Promise((r) => setTimeout(r, opts.intervalMs));
  }
  throw new Error(`sidecar health timeout after ${opts.timeoutMs}ms`);
}

export interface Sidecar {
  baseUrl: string;
  stop: () => Promise<void>;
}

export async function startSidecar(options: {
  pythonExecutable: string;
  engineDir: string;
  port: number;
  env?: Record<string, string>;
}): Promise<Sidecar> {
  const child: ChildProcess = spawn(
    options.pythonExecutable,
    ["-m", "decision_forge.main"],
    {
      cwd: options.engineDir,
      env: {
        ...process.env,
        ...(options.env ?? {}),
        DECISION_FORGE_PORT: String(options.port)
      },
      stdio: ["ignore", "inherit", "inherit"]
    }
  );

  const baseUrl = `http://127.0.0.1:${options.port}`;
  await waitForHealth(baseUrl, { timeoutMs: 15000, intervalMs: 150 });

  return {
    baseUrl,
    stop: () =>
      new Promise<void>((resolve) => {
        if (child.killed || child.exitCode !== null) return resolve();
        child.once("exit", () => resolve());
        child.kill("SIGTERM");
        setTimeout(() => {
          if (child.exitCode === null) child.kill("SIGKILL");
        }, 3000);
      })
  };
}

export function defaultEnginePaths(repoRoot: string) {
  const engineDir = path.resolve(repoRoot, "packages/py-engine");
  const pythonExecutable = path.join(engineDir, ".venv/bin/python");
  return { engineDir, pythonExecutable };
}
```

- [ ] **Step 6: Run test to confirm PASS**

```bash
cd /Users/alexnelja/projects/decision-forge/packages/desktop
pnpm test
```
Expected: PASS.

- [ ] **Step 7: Write `packages/desktop/src/main/scenarios.ts` (stub — Task 7 fills in)**

```ts
import { ipcMain } from "electron";

export function registerScenarioIpc(): void {
  ipcMain.handle("scenarios:list", async () => []);
  ipcMain.handle("scenarios:load", async (_e, id: string) => null);
  ipcMain.handle("scenarios:save", async (_e, _scenario: unknown) => {});
}
```

- [ ] **Step 8: Write `packages/desktop/src/main/keychain.ts` (stub — Plan 4 fills in)**

```ts
// Plan 4 will import keytar and wire real set/get/delete.
export async function getAnthropicKey(): Promise<string | null> {
  return null;
}
export async function setAnthropicKey(_key: string): Promise<void> {
  throw new Error("not implemented — Plan 4");
}
```

- [ ] **Step 9: Write `packages/desktop/src/main/preload.ts`**

```ts
import { contextBridge, ipcRenderer } from "electron";

type ScenarioApi = {
  list: () => Promise<Array<{ id: string; name: string }>>;
  load: (id: string) => Promise<unknown>;
  save: (scenario: unknown) => Promise<void>;
};

const scenarios: ScenarioApi = {
  list: () => ipcRenderer.invoke("scenarios:list"),
  load: (id) => ipcRenderer.invoke("scenarios:load", id),
  save: (scenario) => ipcRenderer.invoke("scenarios:save", scenario)
};

contextBridge.exposeInMainWorld("api", {
  sidecarUrl: () => (process.env.SIDECAR_URL ?? "http://127.0.0.1:8765"),
  scenarios
});
```

- [ ] **Step 10: Write `packages/desktop/src/main/index.ts`**

```ts
import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { startSidecar, defaultEnginePaths, Sidecar } from "./sidecar.js";
import { registerScenarioIpc } from "./scenarios.js";

const PORT = 8765;
let sidecar: Sidecar | null = null;

async function createWindow(): Promise<void> {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: "#0a0a0a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  process.env.SIDECAR_URL = sidecar?.baseUrl ?? `http://127.0.0.1:${PORT}`;
  if (process.env.VITE_DEV_SERVER_URL) {
    await win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    await win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(async () => {
  const repoRoot = path.resolve(__dirname, "../../../..");
  const { engineDir, pythonExecutable } = defaultEnginePaths(repoRoot);
  sidecar = await startSidecar({ engineDir, pythonExecutable, port: PORT });
  registerScenarioIpc();
  ipcMain.handle("sidecar:url", () => sidecar?.baseUrl ?? "");
  await createWindow();
});

app.on("window-all-closed", async () => {
  await sidecar?.stop();
  sidecar = null;
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", async () => {
  await sidecar?.stop();
  sidecar = null;
});
```

- [ ] **Step 11: Build main to confirm it compiles**

```bash
cd /Users/alexnelja/projects/decision-forge/packages/desktop
pnpm build:main
```
Expected: `dist/main/index.js` and `dist/main/preload.js` produced, no errors.

- [ ] **Step 12: Commit**

```bash
cd /Users/alexnelja/projects/decision-forge
git add -A
git commit -m "feat(desktop): Electron main + sidecar supervisor"
```

---

### Task 5: Desktop renderer — React + Vite + Tailwind + three module pages

**Goal:** `pnpm dev` launches Vite + Electron, the window shows a dark-themed shell with a sidebar listing three modules, routing works, each page renders a placeholder. Smoke test (vitest) renders `<App />` and asserts sidebar links exist.

**Files:**
- Create: `packages/desktop/vite.config.ts`
- Create: `packages/desktop/tailwind.config.js`
- Create: `packages/desktop/postcss.config.js`
- Create: `packages/desktop/index.html`
- Create: `packages/desktop/src/renderer/main.tsx`
- Create: `packages/desktop/src/renderer/App.tsx`
- Create: `packages/desktop/src/renderer/index.css`
- Create: `packages/desktop/src/renderer/components/Sidebar.tsx`
- Create: `packages/desktop/src/renderer/components/ModuleFrame.tsx`
- Create: `packages/desktop/src/renderer/pages/Home.tsx`
- Create: `packages/desktop/src/renderer/pages/MonteCarlo.tsx`
- Create: `packages/desktop/src/renderer/pages/Negotiation.tsx`
- Create: `packages/desktop/src/renderer/pages/Forecast.tsx`
- Create: `packages/desktop/src/renderer/lib/sidecar-client.ts`
- Create: `packages/desktop/src/renderer/lib/scenarios-api.ts`
- Create: `packages/desktop/tests/renderer/App.test.tsx`

- [ ] **Step 1: Write `packages/desktop/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [react()],
  server: { port: 5273 },
  build: {
    outDir: "dist/renderer",
    emptyOutDir: true
  }
});
```

- [ ] **Step 2: Write `packages/desktop/tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/renderer/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forge: {
          bg: "#0a0a0a",
          panel: "#111113",
          border: "#1f1f22",
          accent: "#6366f1",
          mc: "#22d3ee",
          nego: "#f59e0b",
          forecast: "#10b981"
        }
      }
    }
  },
  plugins: []
};
```

- [ ] **Step 3: Write `packages/desktop/postcss.config.js`**

```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

- [ ] **Step 4: Write `packages/desktop/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Decision Forge</title>
    <meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' http://127.0.0.1:*;" />
  </head>
  <body class="bg-forge-bg text-neutral-100">
    <div id="root"></div>
    <script type="module" src="/src/renderer/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Write `packages/desktop/src/renderer/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; }
```

- [ ] **Step 6: Write failing test `packages/desktop/tests/renderer/App.test.tsx`**

Add dev deps first: `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`.

Append these to `packages/desktop/package.json` `devDependencies`:
```json
"@testing-library/react": "^16.0.0",
"@testing-library/jest-dom": "^6.5.0",
"jsdom": "^25.0.0"
```

Add to `vite.config.ts`:
```ts
// at top:
/// <reference types="vitest" />
// inside defineConfig object, add:
// test: { environment: "jsdom", setupFiles: ["./tests/setup.ts"] }
```

Create `packages/desktop/tests/setup.ts`:
```ts
import "@testing-library/jest-dom";
```

Then write the test `packages/desktop/tests/renderer/App.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../../src/renderer/App";

describe("App shell", () => {
  it("renders all three module links", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByRole("link", { name: /monte carlo/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /negotiation/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /forecast/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run test to confirm FAIL**

Run: `cd packages/desktop && pnpm install && pnpm test`
Expected: FAIL — App.tsx does not exist.

- [ ] **Step 8: Write `packages/desktop/src/renderer/components/Sidebar.tsx`**

```tsx
import { NavLink } from "react-router-dom";

const modules = [
  { to: "/mc", label: "Monte Carlo", color: "text-forge-mc" },
  { to: "/negotiation", label: "Negotiation", color: "text-forge-nego" },
  { to: "/forecast", label: "Forecast", color: "text-forge-forecast" }
];

export function Sidebar() {
  return (
    <nav className="w-60 bg-forge-panel border-r border-forge-border h-full flex flex-col">
      <div className="p-5 text-lg font-semibold tracking-tight">Decision Forge</div>
      <ul className="flex-1 px-2 space-y-1">
        {modules.map((m) => (
          <li key={m.to}>
            <NavLink
              to={m.to}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md text-sm ${m.color} hover:bg-forge-border/40 ${
                  isActive ? "bg-forge-border/60" : ""
                }`
              }
            >
              {m.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 9: Write `packages/desktop/src/renderer/components/ModuleFrame.tsx`**

```tsx
import { ReactNode } from "react";

export function ModuleFrame({
  title,
  accent,
  children
}: {
  title: string;
  accent: string;
  children: ReactNode;
}) {
  return (
    <section className="flex-1 p-8 overflow-auto">
      <header className="mb-6">
        <h1 className={`text-2xl font-semibold ${accent}`}>{title}</h1>
      </header>
      <div>{children}</div>
    </section>
  );
}
```

- [ ] **Step 10: Write the four pages**

`Home.tsx`:
```tsx
import { ModuleFrame } from "../components/ModuleFrame";
export default function Home() {
  return (
    <ModuleFrame title="Decision Forge" accent="text-forge-accent">
      <p className="text-neutral-400 max-w-2xl">
        Choose a module. Monte Carlo for uncertain outcomes, Negotiation for deal rehearsal,
        Forecast for calibrated predictions.
      </p>
    </ModuleFrame>
  );
}
```

`MonteCarlo.tsx`:
```tsx
import { ModuleFrame } from "../components/ModuleFrame";
export default function MonteCarlo() {
  return <ModuleFrame title="Monte Carlo" accent="text-forge-mc">Coming in Plan 3.</ModuleFrame>;
}
```

`Negotiation.tsx`:
```tsx
import { ModuleFrame } from "../components/ModuleFrame";
export default function Negotiation() {
  return <ModuleFrame title="Negotiation Dojo" accent="text-forge-nego">Coming in Plan 4.</ModuleFrame>;
}
```

`Forecast.tsx`:
```tsx
import { ModuleFrame } from "../components/ModuleFrame";
export default function Forecast() {
  return <ModuleFrame title="Forecast Journal" accent="text-forge-forecast">Coming in Plan 2.</ModuleFrame>;
}
```

- [ ] **Step 11: Write `packages/desktop/src/renderer/App.tsx`**

```tsx
import { Route, Routes } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import Home from "./pages/Home";
import MonteCarlo from "./pages/MonteCarlo";
import Negotiation from "./pages/Negotiation";
import Forecast from "./pages/Forecast";

export default function App() {
  return (
    <div className="flex h-full">
      <Sidebar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/mc" element={<MonteCarlo />} />
        <Route path="/negotiation" element={<Negotiation />} />
        <Route path="/forecast" element={<Forecast />} />
      </Routes>
    </div>
  );
}
```

- [ ] **Step 12: Write `packages/desktop/src/renderer/main.tsx`**

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
```

- [ ] **Step 13: Write `packages/desktop/src/renderer/lib/sidecar-client.ts`**

```ts
declare global {
  interface Window {
    api: {
      sidecarUrl: () => string;
      scenarios: {
        list: () => Promise<Array<{ id: string; name: string }>>;
        load: (id: string) => Promise<unknown>;
        save: (scenario: unknown) => Promise<void>;
      };
    };
  }
}

export function sidecarUrl(): string {
  return typeof window !== "undefined" && window.api
    ? window.api.sidecarUrl()
    : "http://127.0.0.1:8765";
}

export async function getHealth(): Promise<{ status: string; version: string }> {
  const resp = await fetch(`${sidecarUrl()}/health`);
  if (!resp.ok) throw new Error(`sidecar unhealthy: ${resp.status}`);
  return resp.json();
}
```

- [ ] **Step 14: Write `packages/desktop/src/renderer/lib/scenarios-api.ts`**

```ts
export const scenariosApi = {
  list: () => window.api.scenarios.list(),
  load: (id: string) => window.api.scenarios.load(id),
  save: (scenario: unknown) => window.api.scenarios.save(scenario)
};
```

- [ ] **Step 15: Run tests**

```bash
cd /Users/alexnelja/projects/decision-forge/packages/desktop
pnpm install
pnpm test
```
Expected: PASS.

- [ ] **Step 16: Smoke-test live**

```bash
cd /Users/alexnelja/projects/decision-forge
# Ensure py-engine venv exists first:
cd packages/py-engine && source .venv/bin/activate && cd ../..
cd packages/desktop
pnpm dev
```
Expected: Electron window opens with dark sidebar, three module links, placeholder pages navigate, DevTools console shows no errors.

Stop with Ctrl-C.

- [ ] **Step 17: Commit**

```bash
cd /Users/alexnelja/projects/decision-forge
git add -A
git commit -m "feat(desktop): React renderer with Tailwind shell and three module pages"
```

---

### Task 6: Scenario file I/O (main process) + IPC wiring

**Goal:** Replace the `scenarios.ts` stub with real JSON read/write under `~/DecisionForge/scenarios/`. Validate with `ScenarioSchema` from `@decision-forge/core` on load and save. Vitest covers save → list → load roundtrip using a tmp dir.

**Files:**
- Modify: `packages/desktop/src/main/scenarios.ts`
- Create: `packages/desktop/tests/main/scenarios.test.ts`

- [ ] **Step 1: Write failing test `packages/desktop/tests/main/scenarios.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ScenarioStore } from "../../src/main/scenarios.js";
import type { Scenario } from "@decision-forge/core";

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "df-"));
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

const sample = (id: string, name: string): Scenario => ({
  id,
  name,
  created: "2026-04-13T10:00:00Z",
  tags: ["test"],
  description: "",
  modules: {},
  runs: []
});

describe("ScenarioStore", () => {
  it("saves, lists, and loads a scenario", async () => {
    const store = new ScenarioStore(tmp);
    const s = sample("11111111-1111-1111-1111-111111111111", "alpha");
    await store.save(s);
    const list = await store.list();
    expect(list).toEqual([{ id: s.id, name: "alpha" }]);
    const loaded = await store.load(s.id);
    expect(loaded).toEqual(s);
  });

  it("rejects invalid scenarios on save", async () => {
    const store = new ScenarioStore(tmp);
    await expect(store.save({ bogus: true } as unknown as Scenario)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to confirm FAIL**

Run: `cd packages/desktop && pnpm test`
Expected: FAIL — `ScenarioStore` does not exist.

- [ ] **Step 3: Rewrite `packages/desktop/src/main/scenarios.ts`**

```ts
import { ipcMain } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { ScenarioSchema, scenariosDir, type Scenario } from "@decision-forge/core";

export class ScenarioStore {
  private readonly dir: string;
  constructor(appDataOverride?: string) {
    this.dir = scenariosDir(appDataOverride);
  }

  private async ensure(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
  }

  async save(scenario: Scenario): Promise<void> {
    const parsed = ScenarioSchema.parse(scenario);
    await this.ensure();
    const file = path.join(this.dir, `${parsed.id}.json`);
    await fs.writeFile(file, JSON.stringify(parsed, null, 2), "utf8");
  }

  async load(id: string): Promise<Scenario | null> {
    const file = path.join(this.dir, `${id}.json`);
    try {
      const raw = await fs.readFile(file, "utf8");
      return ScenarioSchema.parse(JSON.parse(raw));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }

  async list(): Promise<Array<{ id: string; name: string }>> {
    try {
      await this.ensure();
      const entries = await fs.readdir(this.dir);
      const out: Array<{ id: string; name: string }> = [];
      for (const e of entries) {
        if (!e.endsWith(".json")) continue;
        try {
          const raw = await fs.readFile(path.join(this.dir, e), "utf8");
          const parsed = ScenarioSchema.parse(JSON.parse(raw));
          out.push({ id: parsed.id, name: parsed.name });
        } catch {
          // skip malformed
        }
      }
      return out.sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  }
}

let store: ScenarioStore | null = null;

export function registerScenarioIpc(appDataOverride?: string): void {
  store = new ScenarioStore(appDataOverride);
  ipcMain.handle("scenarios:list", () => store!.list());
  ipcMain.handle("scenarios:load", (_e, id: string) => store!.load(id));
  ipcMain.handle("scenarios:save", (_e, scenario: Scenario) => store!.save(scenario));
}
```

- [ ] **Step 4: Run test to confirm PASS**

Run: `cd packages/desktop && pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/alexnelja/projects/decision-forge
git add -A
git commit -m "feat(desktop): Scenario file I/O with Zod validation"
```

---

### Task 7: CLI stub package

**Goal:** Minimal `@decision-forge/cli` package so the monorepo has the four packages the design calls for. Binary `decision-forge` prints `version`. Proves the workspace plumbing.

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/src/index.ts`
- Create: `packages/cli/tests/index.test.ts`

- [ ] **Step 1: Write `packages/cli/package.json`**

```json
{
  "name": "@decision-forge/cli",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": { "decision-forge": "dist/index.js" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "clean": "rm -rf dist"
  },
  "dependencies": { "@decision-forge/core": "workspace:*" },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Write `packages/cli/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src/**/*"],
  "references": [{ "path": "../core" }]
}
```

- [ ] **Step 3: Write failing test `packages/cli/tests/index.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { run } from "../src/index.js";

describe("cli", () => {
  it("version prints 0.1.0", async () => {
    const out = await run(["version"]);
    expect(out).toBe("decision-forge 0.1.0");
  });
  it("unknown command returns usage", async () => {
    const out = await run(["banana"]);
    expect(out).toMatch(/usage/i);
  });
});
```

- [ ] **Step 4: Run test to confirm FAIL**

Run: `cd /Users/alexnelja/projects/decision-forge && pnpm install && cd packages/cli && pnpm test`
Expected: FAIL.

- [ ] **Step 5: Write `packages/cli/src/index.ts`**

```ts
#!/usr/bin/env node
export async function run(argv: string[]): Promise<string> {
  const [cmd] = argv;
  switch (cmd) {
    case "version":
      return "decision-forge 0.1.0";
    default:
      return "usage: decision-forge <version>";
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv.slice(2)).then((out) => console.log(out));
}
```

- [ ] **Step 6: Run test to confirm PASS**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd /Users/alexnelja/projects/decision-forge
git add -A
git commit -m "feat(cli): stub package with version command"
```

---

### Task 8: End-to-end smoke test with Playwright

**Goal:** A Playwright test that launches the full Electron app (with the real Python sidecar), navigates to each module page, and asserts the sidecar `/health` is reachable from the renderer.

**Files:**
- Create: `packages/desktop/playwright.config.ts`
- Create: `packages/desktop/tests/e2e/smoke.spec.ts`

- [ ] **Step 1: Write `packages/desktop/playwright.config.ts`**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  retries: 0,
  workers: 1,
  use: { trace: "on-first-retry" }
});
```

- [ ] **Step 2: Ensure sidecar venv exists**

```bash
cd /Users/alexnelja/projects/decision-forge/packages/py-engine
test -d .venv || (python3.12 -m venv .venv && source .venv/bin/activate && pip install -e ".[dev]")
```

- [ ] **Step 3: Write `packages/desktop/tests/e2e/smoke.spec.ts`**

```ts
import { test, expect, _electron as electron } from "@playwright/test";
import path from "node:path";

test("boots app, sidecar is healthy, all module pages render", async () => {
  const app = await electron.launch({
    args: [path.resolve(__dirname, "../../dist/main/index.js")],
    env: { ...process.env, NODE_ENV: "test" }
  });
  const window = await app.firstWindow();
  await window.waitForLoadState("domcontentloaded");

  // sidecar reachable from renderer
  const health = await window.evaluate(async () => {
    const url = (window as any).api.sidecarUrl();
    const r = await fetch(`${url}/health`);
    return r.json();
  });
  expect(health.status).toBe("ok");

  // all three module links present
  await expect(window.getByRole("link", { name: /monte carlo/i })).toBeVisible();
  await expect(window.getByRole("link", { name: /negotiation/i })).toBeVisible();
  await expect(window.getByRole("link", { name: /forecast/i })).toBeVisible();

  // navigate to each
  await window.getByRole("link", { name: /monte carlo/i }).click();
  await expect(window.getByRole("heading", { name: /monte carlo/i })).toBeVisible();
  await window.getByRole("link", { name: /negotiation/i }).click();
  await expect(window.getByRole("heading", { name: /negotiation dojo/i })).toBeVisible();
  await window.getByRole("link", { name: /forecast/i }).click();
  await expect(window.getByRole("heading", { name: /forecast journal/i })).toBeVisible();

  await app.close();
});
```

- [ ] **Step 4: Build everything**

```bash
cd /Users/alexnelja/projects/decision-forge
pnpm -r build
```
Expected: all packages build without errors.

- [ ] **Step 5: Install Playwright browsers**

```bash
cd /Users/alexnelja/projects/decision-forge/packages/desktop
pnpm exec playwright install chromium
```

- [ ] **Step 6: Run the e2e test**

```bash
pnpm test:e2e
```
Expected: PASS. If it fails, diagnose: (a) sidecar didn't start — check `packages/py-engine/.venv/bin/python` exists, (b) renderer built to wrong path — check `dist/renderer/index.html` exists, (c) preload path mismatch — check `dist/main/preload.js` exists.

- [ ] **Step 7: Commit**

```bash
cd /Users/alexnelja/projects/decision-forge
git add -A
git commit -m "test(desktop): Playwright e2e smoke test (app + sidecar + nav)"
```

---

### Task 9: Repo-level README + first-run docs

**Goal:** Root `README.md` that documents how to set up and run the project from scratch. Anyone with the repo can get to a working app.

**Files:**
- Modify: `/Users/alexnelja/projects/decision-forge/README.md`

- [ ] **Step 1: Rewrite `README.md`**

```markdown
# Decision Forge

Personal decision gym — Monte Carlo, AI negotiation, calibrated forecasting.

Design: `docs/superpowers/specs/2026-04-13-decision-forge-design.md` (parent repo).

## First-run setup

Prereqs: Node 20+, pnpm 9, Python 3.12.

```bash
# 1. JS deps
pnpm install

# 2. Python sidecar venv
cd packages/py-engine
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cd ../..

# 3. Build
pnpm -r build

# 4. Run
cd packages/desktop
pnpm dev
```

## Layout

- `packages/core` — TypeScript types + Zod schemas
- `packages/py-engine` — FastAPI math sidecar (Python 3.12)
- `packages/desktop` — Electron + React (Vite) app
- `packages/cli` — CLI stub

## Tests

```bash
pnpm test             # all unit tests across workspace
cd packages/desktop
pnpm test:e2e         # Playwright e2e (requires sidecar venv ready)
```

## Data locations

- Scenarios: `~/DecisionForge/scenarios/*.json`
- Forecasts DB: `~/DecisionForge/forecasts.db` (created in Plan 2)
- Anthropic API key: OS keychain (Plan 4)
```

- [ ] **Step 2: Commit**

```bash
cd /Users/alexnelja/projects/decision-forge
git add -A
git commit -m "docs(repo): README with setup and run instructions"
```

---

## Definition of Done (Plan 1)

- [ ] `pnpm install && pnpm -r build` succeeds from a clean clone
- [ ] `pnpm test` passes across all packages
- [ ] `pnpm test:e2e` in `packages/desktop` passes (app boots, sidecar reachable, all pages navigate)
- [ ] Running `cd packages/desktop && pnpm dev` opens the Electron window with the three-module sidebar
- [ ] `~/DecisionForge/scenarios/` is writable via `window.api.scenarios.save` (verified via e2e or manual smoke)
- [ ] No TODO/FIXME in the code for anything in this plan (Plan 2/3/4 references are fine)

Next: **Plan 2 — Forecast Journal** — starts once Plan 1 is DONE.
