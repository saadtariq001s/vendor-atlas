// Runs once when the server starts, before it takes requests.
//
// 1. Applies any new database migrations, so a container built from a newer
//    version of the app brings its own schema with it.
// 2. If the directory has no accounts yet and ADMIN_EMAIL / ADMIN_PASSWORD
//    are set, creates that administrator. This is how the first sign-in is
//    made on an office PC that nobody runs commands on. Once any account
//    exists the variables are ignored, so they can't reset a password later.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.ATLAS_SKIP_SETUP === "1") return;

  const [{ default: pg }, { poolConfig }, { migrate }, { hashPassword }] = await Promise.all([
    import("pg"),
    import("@/lib/db"),
    import("@/lib/migrate"),
    import("@/lib/password"),
  ]);

  const client = new pg.Client(poolConfig());
  await client.connect();
  try {
    const applied = await migrate(client, (s) => console.log(`[setup] ${s}`));
    if (applied) console.log(`[setup] ${applied} migration(s) applied.`);

    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (email && password) {
      const { rows } = await client.query<{ n: number }>(`select count(*)::int n from public.app_users`);
      if (rows[0].n === 0) {
        if (password.length < 10) {
          console.error("[setup] ADMIN_PASSWORD must be at least 10 characters; no account was created.");
        } else {
          await client.query(
            `insert into public.app_users (email, name, password_hash, role) values ($1, $2, $3, 'admin')`,
            [email, process.env.ADMIN_NAME?.trim() || null, await hashPassword(password)],
          );
          console.log(`[setup] Created the first administrator: ${email}`);
        }
      }
    }
  } finally {
    await client.end();
  }
}
