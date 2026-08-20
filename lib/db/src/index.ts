import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

let dbUrl = process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error(
    "SUPABASE_DATABASE_URL or DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Supabase transaction pooler (6543) is blocked in some environments; use session pooler (5432)
dbUrl = dbUrl.replace(/:6543\//, ":5432/");

export const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
export const db = drizzle(pool, { schema });

export * from "./schema";
