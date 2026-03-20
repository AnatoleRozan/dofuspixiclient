import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";

import type { Database } from "./schema.ts";

const { Pool } = pg;

const pool = new Pool({
  host: process.env.PG_HOST ?? "localhost",
  port: Number(process.env.PG_PORT ?? 5432),
  database: process.env.PG_DATABASE ?? "dofus",
  user: process.env.PG_USER ?? "dofus",
  password: process.env.PG_PASSWORD ?? "dofus",
  max: 20,
});

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
});

/**
 * Run lightweight migrations on startup.
 * Adds columns that may not yet exist (idempotent).
 */
export async function runMigrations(): Promise<void> {
  try {
    await pool.query(`
      ALTER TABLE characters ADD COLUMN IF NOT EXISTS inventory JSONB DEFAULT '[]';
    `);
    console.log("[DB] Migrations applied.");
  } catch (err) {
    console.error("[DB] Migration error:", err);
  }
}
