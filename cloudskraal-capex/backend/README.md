# Cloudskraal CapEx Backend

Express.js API for the Cloudskraal Capital Expenditure evaluation platform.

## Setup

```bash
cd backend
npm install
npm run dev    # development with auto-reload
npm start      # production
```

The API runs on **http://localhost:3001** by default.

## Database

SQLite database is created automatically at `data/capex.db` on first run. The database is seeded with 22 Cloudskraal CapEx projects, each with projected cash flows and a "Base Case" financing scenario.

To reset the database, delete `data/capex.db` and restart the server.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check |
| GET | /api/dashboard/stats | Dashboard summary statistics |
| GET | /api/projects | List all projects (summaries) |
| GET | /api/projects/:id | Get project with cash flows and scenarios |
| POST | /api/projects | Create a new project |
| PATCH | /api/projects/:id | Update project fields |
| DELETE | /api/projects/:id | Delete a project |
| GET | /api/projects/:id/cashflows | Get project cash flows |
| PUT | /api/projects/:id/cashflows | Replace all cash flows |
| GET | /api/projects/:id/scenarios | Get project scenarios |
| POST | /api/projects/:id/scenarios | Create scenario (computes financials) |
| PATCH | /api/projects/:id/scenarios/:scenarioId | Update scenario (recomputes) |
| DELETE | /api/projects/:id/scenarios/:scenarioId | Delete scenario |

## Financial Engine

Computed on scenario create/update:
- **WACC** — weighted average cost of capital (27% SA corporate tax shield)
- **NPV** — net present value of projected cash flows
- **IRR** — internal rate of return (Newton-Raphson + bisection fallback)
- **Payback period** — interpolated year where cumulative cash flows exceed outlay
- **Profitability Index** — (NPV + outlay) / outlay
- **Monthly payment** — based on repayment type (amortization, equal principal, or bullet)
- **Total interest** — over the loan term

## Stack

- Express.js
- better-sqlite3
- cors
- uuid
