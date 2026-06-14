import { defineConfig } from "drizzle-kit";
import path from "path";

/**
 * drizzle-kit config — PostgreSQL by default; SQLite stub when SQLITE_PATH is set.
 *
 * NOTE: The schema files use pgTable (drizzle-orm/pg-core).  A full SQLite
 * migration requires converting them to sqliteTable (drizzle-orm/sqlite-core).
 * Until that migration is done, drizzle-kit push only works against PostgreSQL.
 */

const SQLITE_PATH  = process.env["SQLITE_PATH"];
const DATABASE_URL = process.env["DATABASE_URL"];

if (SQLITE_PATH && !DATABASE_URL) {
  console.warn(
    "[drizzle-kit] SQLITE_PATH detected but schemas use pgTable (pg-core). " +
    "Migrate schemas to sqliteTable (sqlite-core) before running drizzle-kit push against SQLite.",
  );
}

const url = DATABASE_URL ?? SQLITE_PATH ?? "";

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: DATABASE_URL ? "postgresql" : "sqlite",
  dbCredentials: { url },
});
