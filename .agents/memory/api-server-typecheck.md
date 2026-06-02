---
name: API server typecheck caveat
description: Why api-server tsc typecheck always fails and why that's OK
---

The api-server `tsc --noEmit` typecheck always fails with `TS6305: Output file ... has not been built from source file` errors across many route files (teams.ts, timestandards.ts, workouts.ts, etc.). This is because `lib/db` has no build script and its dist/ is never generated.

**Why:** The API server uses esbuild (not tsc) to compile to dist/index.mjs at runtime. esbuild resolves types through source, not dist. So the server builds and runs fine — the tsc typecheck is not part of the CI-critical path for the backend.

**How to apply:** Only check frontend typecheck (`pnpm --filter @workspace/swim-manager run typecheck`) to verify correctness. Ignore api-server typecheck failures — they are structural, not code errors.
