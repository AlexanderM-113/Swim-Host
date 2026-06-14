/**
 * Database connection — PostgreSQL by default; graceful no-op in Electron
 * when only SQLITE_PATH is set (all data lives in localStorage).
 *
 * SQLITE NOTE:  The schema files use pgTable (drizzle-orm/pg-core).  A full
 * SQLite migration requires converting every schema file to sqliteTable
 * (drizzle-orm/sqlite-core).  That change is deferred so lib/db/src/schema/
 * remains unmodified per the migration spec.
 *
 * Electron mode:  electron/main.ts sets SQLITE_PATH and spawns this server.
 * The renderer uses localStorage for all data — API data routes are never
 * called.  If they somehow are, `db` throws a clear 503-style error.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const DATABASE_URL = process.env["DATABASE_URL"];
const SQLITE_PATH  = process.env["SQLITE_PATH"];
const IS_ELECTRON  = !!SQLITE_PATH;

// ── Build the db / pool ───────────────────────────────────────────────────────

let _pool: InstanceType<typeof Pool> | null = null;
let _db:   ReturnType<typeof drizzle<typeof schema>> | null = null;

if (DATABASE_URL) {
  _pool = new Pool({ connectionString: DATABASE_URL });
  _db   = drizzle(_pool, { schema });
} else if (!IS_ELECTRON) {
  throw new Error(
    "DATABASE_URL must be set.  Provision a PostgreSQL database, or " +
    "run with SQLITE_PATH set (Electron mode — uses localStorage for data).",
  );
} else {
  console.info(
    "[db] Electron / localStorage mode — no database configured.  " +
    "Set DATABASE_URL to enable PostgreSQL-backed API routes.",
  );
}

// ── Exports ───────────────────────────────────────────────────────────────────
//
// `db` is typed as non-null so existing route files (unchanged per spec) don't
// get TypeScript errors.  At runtime in Electron with no DATABASE_URL, the
// proxy throws a descriptive error if any route accidentally reaches it.

export const pool = _pool;

export const db = (_db ??
  new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
    get(_t, prop: string) {
      throw new Error(
        `[db] No database configured (SQLITE_PATH-only Electron mode). ` +
        `Set DATABASE_URL to enable DB feature: db.${prop}()`,
      );
    },
  })) as ReturnType<typeof drizzle<typeof schema>>;

export * from "./schema";
