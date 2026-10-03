import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import { getMigrations } from "better-auth/db/migration";
import { auth } from "./auth.js";
import { pool, authPool } from "./db.js";
if (!process.env.MIGRATION_DATABASE_URL)
  throw Error("MIGRATION_DATABASE_URL is required only by the migration job.");
const migration = new pg.Client({
  connectionString: process.env.MIGRATION_DATABASE_URL,
});
await migration.connect();
try {
  await migration.query("SELECT pg_advisory_lock(87432109)");
  await migration.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const directory = resolve(
    process.env.MIGRATIONS_DIR || "../../packages/database/migrations",
  );
  for (const file of (await readdir(directory))
    .filter((x) => x.endsWith(".sql"))
    .sort()) {
    if (
      (
        await migration.query("SELECT 1 FROM schema_migrations WHERE name=$1", [
          file,
        ])
      ).rowCount
    )
      continue;
    await migration.query("BEGIN");
    try {
      await migration.query(await readFile(resolve(directory, file), "utf8"));
      await migration.query("INSERT INTO schema_migrations(name) VALUES($1)", [
        file,
      ]);
      await migration.query("COMMIT");
      console.log(`Applied ${file}`);
    } catch (error) {
      await migration.query("ROLLBACK");
      throw error;
    }
  }
  await migration.query("GRANT olaph_runtime TO olaph_login");
  await migration.query("GRANT olaph_worker TO olaph_worker_login");
  const plan = await getMigrations(auth.options);
  await plan.runMigrations();
  await authPool.query(
    "CREATE TABLE IF NOT EXISTS app_reauth(session_id text PRIMARY KEY,user_id text NOT NULL,expires_at timestamptz NOT NULL)",
  );
  await authPool.query(
    "CREATE TABLE IF NOT EXISTS app_reauth_attempts(user_id text PRIMARY KEY,failures integer NOT NULL DEFAULT 0,locked_until timestamptz)",
  );
  await authPool.query(
    "CREATE TABLE IF NOT EXISTS app_login_attempts(email_key text PRIMARY KEY,attempts integer NOT NULL CHECK(attempts BETWEEN 1 AND 5),window_ends_at timestamptz NOT NULL)",
  );
  await authPool.query(
    "CREATE INDEX IF NOT EXISTS app_login_expiry ON app_login_attempts(window_ends_at)",
  );
  console.log("Domain and authentication migrations completed.");
} finally {
  await migration.end();
  await pool.end();
  await authPool.end();
}
