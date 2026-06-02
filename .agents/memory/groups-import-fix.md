---
name: groups/index.tsx import fix
description: The groups page must import local-store hooks, not the generated api-client-react
---

The groups page (`artifacts/swim-manager/src/pages/groups/index.tsx`) was incorrectly importing `useListAthletes` and `useListTeams` from `@workspace/api-client-react`. This package has no build script and its dist/ is never generated, causing a hard typecheck failure.

**Why:** SwimManager Pro is localStorage-based. All CRUD hooks live in `@/lib/local-store`. The generated api-client-react was generated early in the project but is not used in the localStorage architecture.

**How to apply:** Any page that uses athlete/team data must import from `@/lib/local-store`, not `@workspace/api-client-react`. If you see a typecheck error about api-client-react dist not built, switch the import to local-store.
