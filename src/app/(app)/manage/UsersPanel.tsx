"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/components/Toaster";

type User = { id: string; email: string; name: string | null; role: string };

const input =
  "h-10 w-full rounded-lg border border-line-strong bg-panel px-3 text-[14px] outline-none focus:border-accent focus:ring-4 focus:ring-accent/15";

export function UsersPanel({ users, me }: { users: User[]; me: string }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async (u: User) => {
    if (!confirm(`Remove ${u.email}? They'll be signed out and won't be able to sign in.`)) return;
    const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return toast(data.error, "error");
    toast(`Removed ${u.email}`);
    router.refresh();
  };

  return (
    <div>
      <ul className="divide-y divide-line">
        {users.map((u) => (
          <li key={u.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium">{u.name ?? u.email}</p>
              <p className="truncate text-[13px] text-ink-3">
                {u.name ? `${u.email}, ` : ""}
                {u.role === "admin" ? "administrator" : "view only"}
              </p>
            </div>
            {u.id === me ? (
              <span className="text-[13px] text-ink-3">You</span>
            ) : (
              <button type="button" onClick={() => remove(u)} className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-ink-2 hover:bg-danger-soft hover:text-danger">
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      {adding ? (
        <form
          className="mt-4 grid gap-3 rounded-xl bg-panel-2 p-4 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const body = Object.fromEntries(new FormData(e.currentTarget));
            const res = await fetch("/api/users", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) return setError(data.error);
            toast(`${body.email} can now sign in`);
            setAdding(false);
            setError(null);
            router.refresh();
          }}
        >
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-ink-2">Email</span>
            <input name="email" type="email" required className={input} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-ink-2">Name</span>
            <input name="name" className={input} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-ink-2">Temporary password</span>
            <input name="password" type="text" minLength={10} required autoComplete="off" className={input} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-ink-2">Access</span>
            <select name="role" className={input} defaultValue="viewer">
              <option value="viewer">View only</option>
              <option value="admin">Administrator (can change data)</option>
            </select>
          </label>
          {error && <p role="alert" className="text-[14px] text-danger sm:col-span-2">{error}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="h-10 rounded-lg bg-accent px-4 text-[14px] font-semibold text-accent-ink hover:bg-accent-hover">
              Give access
            </button>
            <button type="button" onClick={() => setAdding(false)} className="h-10 rounded-lg px-3 text-[14px] text-ink-2 hover:bg-panel">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="mt-3 text-[14px] font-medium text-accent-text hover:underline">
          Give someone access
        </button>
      )}
    </div>
  );
}
