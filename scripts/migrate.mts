// Apply db/migrations/*.sql in order, once each. Safe to re-run.
//   npm run db:migrate
import pg from "pg";
import { poolConfig } from "../src/lib/db";
import { migrate } from "../src/lib/migrate";

const client = new pg.Client(poolConfig());
await client.connect();
try {
  const applied = await migrate(client);
  console.log(applied ? `${applied} migration(s) applied.` : "Database is up to date.");
} finally {
  await client.end();
}
