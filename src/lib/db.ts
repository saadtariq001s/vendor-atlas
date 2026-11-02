import { Pool, type PoolClient } from "pg";

// One pooled connection to Postgres, cached on globalThis: in dev, Next's HMR
// re-imports modules on every edit, which would otherwise leak pools.
const globalForDb = globalThis as unknown as { _pgPool?: Pool };

/**
 * Hosted Postgres (Supabase, Render, Neon) needs TLS; a local database usually
 * has none. `sslmode` is stripped from the URL because pg lets it override
 * the `ssl` option below. Set DATABASE_SSL=disable to force TLS off.
 */
export function poolConfig() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set.");
  const url = new URL(raw);
  url.searchParams.delete("sslmode");
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  const useSsl = process.env.DATABASE_SSL !== "disable" && !local;
  return {
    connectionString: url.toString(),
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  };
}

/**
 * The pool is created on first use, not at import: `next build` loads these
 * modules while collecting route data, on a machine that may have no
 * DATABASE_URL (the Docker image is built that way).
 */
export function getPool(): Pool {
  if (!globalForDb._pgPool) {
    globalForDb._pgPool = new Pool({
      ...poolConfig(),
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return globalForDb._pgPool;
}

/** Close the pool; for scripts that should exit when done. */
export const endPool = () => globalForDb._pgPool?.end();

/** Run a parameterised query. Never interpolate values into the SQL string. */
export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await getPool().query(text, params);
  return res.rows as T[];
}

/** Run a query expecting at most one row. */
export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Run `fn` inside a transaction; rolls back if it throws. */
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
