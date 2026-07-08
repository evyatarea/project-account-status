// database/schema.sql is the single source of truth for DB structure.
// This just applies it; Drizzle's schema.ts is the typed query layer on top,
// kept in sync with it manually (see comment at the top of schema.ts).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Pool } from "pg";
import { env } from "../config/env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(__dirname, "../../../../database/schema.sql");

async function main() {
  const sql = readFileSync(schemaPath, "utf-8");
  const pool = new Pool({ connectionString: env.databaseUrl });
  try {
    await pool.query(sql);
    console.log("Schema applied successfully from database/schema.sql");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
