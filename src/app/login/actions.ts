"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authenticate, createSession, destroySession, pruneSessions } from "@/lib/auth";

// Failed attempts per email+IP, in memory. Enough to stop a password-guessing
// script against a single-instance deployment; resets on restart.
const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 8; // per email and address
const MAX_FAILURES_PER_EMAIL = 25; // per email from anywhere: a header can be faked, the email can't
const failures = new Map<string, { count: number; first: number }>();

function throttled(key: string, max: number): boolean {
  const f = failures.get(key);
  if (!f) return false;
  if (Date.now() - f.first > WINDOW_MS) {
    failures.delete(key);
    return false;
  }
  return f.count >= max;
}

function recordFailure(key: string) {
  const f = failures.get(key);
  if (!f || Date.now() - f.first > WINDOW_MS) failures.set(key, { count: 1, first: Date.now() });
  else f.count++;
}

/**
 * Only same-site paths, so ?next= can't bounce someone to another site.
 * Browsers read both "//host" and "/\\host" as another origin.
 */
function safeNext(value: FormDataEntryValue | null): string {
  const s = String(value ?? "");
  const sameSite = /^\/(?![/\\])/.test(s) && !/[\u0000-\u001f]/.test(s);
  return sameSite && !s.startsWith("/login") ? s : "/";
}

export async function login(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  // React resets the form after an action; returning the email lets the
  // field keep it, so a mistyped password doesn't mean retyping both.
  if (!email || !password) return { error: "Enter your email and password.", email };

  // Through a Cloudflare tunnel, cf-connecting-ip is the visitor's address as
  // Cloudflare saw it; x-forwarded-for can be written by the visitor.
  const h = await headers();
  const ip = h.get("cf-connecting-ip")?.trim() || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const who = email.toLowerCase();
  const key = `${who}|${ip}`;
  const anyKey = `${who}|*`;
  if (throttled(key, MAX_FAILURES) || throttled(anyKey, MAX_FAILURES_PER_EMAIL)) {
    return { error: "Too many attempts. Wait 15 minutes, then try again.", email };
  }

  const user = await authenticate(email, password);
  if (!user) {
    recordFailure(key);
    recordFailure(anyKey);
    // Deliberately not distinguishing "no such user" from "wrong password".
    return { error: "That email and password don't match an account.", email };
  }

  failures.delete(key);
  failures.delete(anyKey);
  await createSession(user.id);
  void pruneSessions().catch(() => {});

  // redirect() throws internally — must sit outside any try/catch.
  redirect(safeNext(formData.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
