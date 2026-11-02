import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { query, queryOne } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

export const SESSION_COOKIE = "atlas_session";
const SESSION_DAYS = 30;

export type Role = "admin" | "viewer";
export type AppUser = { id: string; email: string; name: string | null; role: Role };

// ── sessions ───────────────────────────────────────────────────────────────
// The cookie holds a random opaque token; only its SHA-256 is persisted, so a
// database dump does not yield usable sessions.

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  await query(
    `insert into public.sessions (token_hash, user_id, expires_at) values ($1, $2, $3)`,
    [hashToken(token), userId, expiresAt],
  );

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await query(`delete from public.sessions where token_hash = $1`, [hashToken(token)]);
  }
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user, or null. Safe to call from Server Components. */
export async function getUser(): Promise<AppUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return queryOne<AppUser>(
    `select u.id, u.email, u.name, u.role
       from public.sessions s
       join public.app_users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now()`,
    [hashToken(token)],
  );
}

export async function authenticate(email: string, password: string): Promise<AppUser | null> {
  const row = await queryOne<AppUser & { password_hash: string }>(
    `select id, email, name, role, password_hash from public.app_users where lower(email) = lower($1)`,
    [email],
  );
  // Hash even when the user is absent, so response time does not reveal
  // whether an address exists.
  const stored = row?.password_hash ?? "scrypt$00$00";
  const ok = await verifyPassword(password, stored);
  if (!row || !ok) return null;
  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

/** Best-effort cleanup of expired rows. */
export async function pruneSessions(): Promise<void> {
  await query(`delete from public.sessions where expires_at < now()`);
}

// ── guards for route handlers ──────────────────────────────────────────────

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireUser(): Promise<AppUser> {
  const user = await getUser();
  if (!user) throw new HttpError(401, "Your session has ended. Sign in again.");
  return user;
}

export async function requireAdmin(): Promise<AppUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new HttpError(403, "Only admins can change the directory.");
  return user;
}
