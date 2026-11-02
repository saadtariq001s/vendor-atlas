"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/login/actions";

export function UserMenu({ email, name, role }: { email: string; name: string | null; role: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initials = (name ?? email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="ml-1 grid h-9 w-9 place-items-center rounded-full bg-panel-2 text-[13px] font-semibold text-ink ring-1 ring-line-strong transition hover:ring-accent"
      >
        {initials}
        <span className="sr-only">Account</span>
      </button>
      {open && (
        <div
          role="menu"
          className="pop absolute right-0 top-11 z-50 w-64 overflow-hidden rounded-xl border border-line bg-panel text-ink shadow-[var(--shadow-pop)]"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-[14px] font-semibold">{name ?? email}</p>
            {name && <p className="truncate text-[13px] text-ink-3">{email}</p>}
            <p className="mt-1 text-[12px] text-ink-3">{role === "admin" ? "Administrator" : "View only"}</p>
          </div>
          {role === "admin" && (
            <>
              <Link href="/upload" role="menuitem" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-[14px] hover:bg-panel-2">
                Upload data
              </Link>
              <Link href="/manage" role="menuitem" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-[14px] hover:bg-panel-2">
                Manage directory
              </Link>
            </>
          )}
          <form action={logout}>
            <button type="submit" role="menuitem" className="block w-full px-4 py-2.5 text-left text-[14px] hover:bg-panel-2">
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
