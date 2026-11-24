import { parseEnv } from "@neon/env";
import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import config from "../../neon";
import * as schema from "./schema";

/**
 * node-postgres pool, per the Neon guidance for apps on Vercel (Fluid compute):
 * the app reads the pooled DATABASE_URL, and attachDatabasePool closes idle
 * connections before a function instance is suspended. Migrations use the
 * direct DATABASE_URL_UNPOOLED (see drizzle.config.ts).
 */
const { postgres } = parseEnv(config, ["DATABASE_URL"]);

// Reuse one pool across hot reloads in development.
const globalForDb = globalThis as unknown as { pokecapsPool?: Pool };
const pool = globalForDb.pokecapsPool ?? new Pool({
    connectionString: postgres.databaseUrl,
    max: 5,
    // Fail fast instead of leaving pages on "Loading…" when the database is unreachable.
    connectionTimeoutMillis: 10_000,
    query_timeout: 20_000,
  });
if (process.env.NODE_ENV !== "production") globalForDb.pokecapsPool = pool;
attachDatabasePool(pool);

export const db = drizzle(pool, { schema });
export { pool };
