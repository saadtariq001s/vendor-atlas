"use client";

import Link from "next/link";
import { compare, compareHref, useCompare } from "@/lib/compare-store";
import { XIcon } from "./icons";

const SERIES = ["bg-[var(--s1)]", "bg-[var(--s2)]", "bg-[var(--s3)]", "bg-[var(--s4)]"];

/** On the empty Compare page: what's been picked so far, and the way in. */
export function ComparePicker() {
  const picks = useCompare();
  if (picks.length === 0) return null;
  return (
    <div className="card mt-8 max-w-xl p-5">
      <p className="text-[13px] font-medium text-ink-3">Picked so far</p>
      <ul className="mt-2 divide-y divide-line">
        {picks.map((p, i) => (
          <li key={p.id} className="flex items-center gap-3 py-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${SERIES[i]}`} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{p.name}</span>
            <button type="button" onClick={() => compare.remove(p.id)} className="grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:bg-panel-2 hover:text-ink">
              <XIcon size={16} />
              <span className="sr-only">Remove {p.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {picks.length >= 2 ? (
        <Link href={compareHref(picks.map((p) => p.id))} className="mt-4 inline-flex h-11 items-center rounded-full bg-accent px-5 text-[15px] font-semibold text-accent-ink hover:bg-accent-hover">
          Compare these {picks.length}
        </Link>
      ) : (
        <p className="mt-3 text-[14px] text-ink-3">Pick one more to compare.</p>
      )}
    </div>
  );
}
