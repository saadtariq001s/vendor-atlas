import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Client } from "pg";

// Apply db/migrations/*.sql in order, once each. Safe to re-run. Used by
// `npm run db:migrate` and by the server itself at start-up, so a fresh
// container comes up with its tables in place.
export async function migrate(client: Client, log: (s: string) => void = console.log): Promise<number> {
  const dir = join(process.cwd(), "db", "migrations");
  await client.query(`create table if not exists public.schema_migrations (
    name text primary key, applied_at timestamptz not null default now())`);
  // One migrator at a time, should two instances start together.
  await client.query(`select pg_advisory_lock(7245001)`);
  try {
    const done = new Set(
      (await client.query<{ name: string }>(`select name from public.schema_migrations`)).rows.map((r) => r.name),
    );
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    let applied = 0;
    for (const file of files) {
      if (done.has(file)) continue;
      await client.query("begin");
      try {
        await client.query(readFileSync(join(dir, file), "utf8"));
        await client.query(`insert into public.schema_migrations (name) values ($1)`, [file]);
        await client.query("commit");
        log(`applied  ${file}`);
        applied++;
      } catch (e) {
        await client.query("rollback");
        throw e;
      }
    }
    return applied;
  } finally {
    await client.query(`select pg_advisory_unlock(7245001)`);
  }
}
