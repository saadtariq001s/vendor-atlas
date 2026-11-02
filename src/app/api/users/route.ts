import { NextResponse } from "next/server";
import { HttpError, requireAdmin } from "@/lib/auth";
import { handle } from "@/lib/api";
import { query } from "@/lib/db";
import { hashPassword } from "@/lib/password";

/** Give someone a sign-in: { email, name?, role, password } */
export const POST = handle(async (request: Request) => {
  await requireAdmin();
  const b = (await request.json()) as Record<string, unknown>;
  const email = String(b.email ?? "").trim().toLowerCase();
  const name = String(b.name ?? "").trim() || null;
  const role = b.role === "admin" ? "admin" : "viewer";
  const password = String(b.password ?? "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, "Enter a valid email address.");
  if (password.length < 10) throw new HttpError(400, "Use a password of at least 10 characters.");

  const rows = await query(
    `insert into public.app_users (email, name, role, password_hash) values ($1, $2, $3, $4)
     on conflict (email) do nothing returning id`,
    [email, name, role, await hashPassword(password)],
  );
  if (rows.length === 0) throw new HttpError(409, `${email} already has an account.`);
  return NextResponse.json({ ok: true }, { status: 201 });
});
