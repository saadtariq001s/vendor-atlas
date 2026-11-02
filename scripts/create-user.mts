// Create a sign-in, or reset the password of an existing one.
//   npm run user:create -- owner@company.ae admin "Full Name"
//   npm run user:create -- assistant@company.ae viewer
// Prompts for the password; set ATLAS_PASSWORD to skip the prompt (CI only).
import { createInterface } from "node:readline/promises";
import pg from "pg";
import { poolConfig } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";

const [email, role = "admin", name] = process.argv.slice(2);
if (!email || !["admin", "viewer"].includes(role)) {
  console.error('usage: npm run user:create -- <email> [admin|viewer] ["Full Name"]');
  process.exit(1);
}

async function askPassword(): Promise<string> {
  if (process.env.ATLAS_PASSWORD) return process.env.ATLAS_PASSWORD;
  const rl = createInterface({ input: process.stdin, output: process.stderr, terminal: true });
  // Mute echo: overwrite what readline would print with nothing.
  const out = rl as unknown as { _writeToOutput: (s: string) => void };
  let prompting = true;
  out._writeToOutput = (s) => {
    if (!prompting || s.includes("Password")) process.stderr.write(s);
  };
  const pw = await rl.question("Password (min 10 characters): ");
  prompting = false;
  rl.close();
  process.stderr.write("\n");
  return pw;
}

const password = await askPassword();
if (password.length < 10) {
  console.error("Use at least 10 characters.");
  process.exit(1);
}

const client = new pg.Client(poolConfig());
await client.connect();
try {
  const hash = await hashPassword(password);
  const res = await client.query<{ created: boolean }>(
    `insert into public.app_users (email, name, role, password_hash)
     values (lower($1), $2, $3, $4)
     on conflict (email) do update set
       password_hash = excluded.password_hash,
       role = excluded.role,
       name = coalesce(excluded.name, app_users.name)
     returning (xmax = 0) as created`,
    [email, name ?? null, role, hash],
  );
  // A password change signs the account out everywhere.
  if (!res.rows[0].created) {
    await client.query(
      `delete from public.sessions where user_id = (select id from public.app_users where email = lower($1))`,
      [email],
    );
  }
  console.log(`${res.rows[0].created ? "Created" : "Updated"} ${role} ${email.toLowerCase()}`);
} finally {
  await client.end();
}
