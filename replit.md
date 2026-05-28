# SwimManager Pro

Professional-grade swimming management software covering meet management, workout design, team/athlete tracking, billing, and scoreboard display — all in one system.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/swim-manager run dev` — run the frontend (port 21868)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (artifacts/swim-manager)
- API: Express 5 (artifacts/api-server)
- DB: PostgreSQL + Drizzle ORM (lib/db)
- Validation: Zod (zod/v4), drizzle-zod
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- **OpenAPI spec**: `lib/api-spec/openapi.yaml`
- **DB schema**: `lib/db/src/schema/` (club, teams, athletes, meets, sessions, events, entries, results, relays, timestandards, workouts, billing)
- **API routes**: `artifacts/api-server/src/routes/`
- **Frontend pages**: `artifacts/swim-manager/src/pages/`
- **Generated hooks**: `lib/api-client-react/src/generated/api.ts`

## Architecture decisions

- Contract-first API: OpenAPI spec gates all frontend/backend type generation via Orval
- All entity names in OpenAPI use entity-shaped names (NoteInput, not CreateNoteBody) to avoid Orval TS2308 collision
- Query parameters on nested routes (path + query params combined) are removed to avoid `ListXxxParams` Zod collision
- Swimming times stored as float seconds; display formatting (MM:SS.ss) handled frontend
- No user authentication — club identification only via club settings

## Product

SwimManager Pro is a full-featured aquatic management platform with four major modules:

1. **Meet Manager** — Create meets, set up sessions/events, manage entries, run seeding, record live results, track team scores
2. **Workout Manager** — Design and store workouts with per-set detail (stroke, distance, reps, rest interval, intensity)
3. **Team Manager** — Athlete roster with full contact/health info, team management, billing/invoicing
4. **Scoreboard** — Full-screen display of current heat/event results, pace clock

## User preferences

- Swimming-themed UI (deep pool blues, professional dense layout)
- No user login — club-level identification only
- Can be packaged as desktop .exe via Electron
- Swimming standard file format (.hy3/.cl2) import/export planned

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing openapi.yaml
- Don't add both path params AND query params to the same GET endpoint (causes ListXxxParams TS collision)
- DB push: `pnpm --filter @workspace/db run push`
- Times are stored as seconds (float) in DB — format client-side as MM:SS.ss

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
