# Real Estate Operations Agent

Internal SaaS platform for real estate companies that automates repetitive operational tasks — lead management, CRM, property listings, task tracking, calendar, and a visual workflow automation engine.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/reoa run dev` — run the frontend (port 20425)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19, Vite, Tailwind CSS, shadcn/ui, wouter, TanStack Query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (v4), drizzle-zod
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Logging: Pino + pino-http

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for the API contract
- `lib/db/src/schema/` — Drizzle table definitions (agents, leads, properties, clients, notes, tasks, appointments, workflows, notifications, activity_logs)
- `artifacts/api-server/src/routes/` — Express route handlers (dashboard, agents, leads, properties, clients, tasks, appointments, workflows, notifications, reports)
- `artifacts/reoa/src/` — React frontend

## Architecture decisions

- Contract-first: OpenAPI spec → codegen → Zod schemas (server) + React Query hooks (frontend)
- Automation engine: workflow rules stored as JSON (trigger/conditions/actions), evaluated server-side on entity events
- Date serialization: DB returns `Date` objects; routes use `JSON.parse(JSON.stringify(data))` before Zod `.parse()` for timestamp fields to coerce them to ISO strings
- All API routes use generated Zod schemas from `@workspace/api-zod` for input validation and output shaping

## Product

- **Dashboard** — stats, pipeline by stage, today's tasks, recent activity feed
- **Lead Center** — full lead lifecycle (new → closed/lost), notes, activity timeline
- **Properties** — listing management with status, type, assignment
- **CRM (Clients)** — client profiles, notes, activity
- **Tasks** — follow-ups, calls, meetings, reminders with priority/due date
- **Calendar** — appointments (viewings, meetings, follow-ups)
- **Workflows** — visual automation builder with trigger→conditions→actions, execution logs
- **Reports** — lead conversion, team performance, automation activity
- **Notifications** — read/unread notification center

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any OpenAPI spec change, always re-run codegen: `pnpm --filter @workspace/api-spec run codegen`
- DB timestamp columns return `Date` objects; wrap with `JSON.parse(JSON.stringify(...))` before Zod parse in routes
- Vite frontend reads `PORT` and `BASE_PATH` from env — do not hardcode ports

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
