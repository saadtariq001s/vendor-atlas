"use client";

import { useActionState } from "react";
import { login } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, null);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          defaultValue={state?.email ?? ""}
          required
          autoFocus={!state?.email}
          className="h-12 w-full rounded-xl border border-line-strong bg-panel px-3.5 text-[15px] text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus={Boolean(state?.email)}
          className="h-12 w-full rounded-xl border border-line-strong bg-panel px-3.5 text-[15px] text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
        />
      </label>

      {state?.error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3.5 py-2.5 text-[14px] text-danger">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-full bg-accent text-[15px] font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
