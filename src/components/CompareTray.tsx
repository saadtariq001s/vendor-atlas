"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COMPARE_MAX, compare, compareHref, useCompare } from "@/lib/compare-store";
import { ScaleIcon, XIcon } from "./icons";
import { toast } from "./Toaster";

const SERIES = ["bg-[var(--s1)]", "bg-[var(--s2)]", "bg-[var(--s3)]", "bg-[var(--s4)]"];

/** A small button that adds a vendor to the comparison, or removes it. */
export function CompareButton({
  id,
  name,
  size = "md",
  className = "",
}: {
  id: number;
  name: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const picks = useCompare();
  const on = picks.some((p) => p.id === id);

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!compare.toggle({ id, name })) toast(`You can compare up to ${COMPARE_MAX} vendors. Remove one first.`, "error");
  };

  const h = size === "sm" ? "h-8 px-2.5 text-[12px]" : "h-9 px-3 text-[13px]";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex items-center gap-1.5 rounded-full border font-medium transition ${h} ${
        on ? "border-ink bg-ink text-panel" : "border-line-strong bg-panel text-ink-2 hover:border-ink hover:text-ink"
      } ${className}`}
    >
      <ScaleIcon size={size === "sm" ? 14 : 15} />
      {on ? "In comparison" : "Compare"}
    </button>
  );
}

/** The picked vendors, docked at the bottom of every page until compared. */
export function CompareTray() {
  const picks = useCompare();
  const pathname = usePathname();
  if (picks.length === 0 || pathname === "/compare") return null;

  const ready = picks.length >= 2;
  return (
    <div className="pop no-print fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="flex w-full max-w-[720px] items-center gap-2 rounded-2xl border border-line bg-panel/95 p-2 pl-3 shadow-[var(--shadow-pop)] backdrop-blur">
        <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {picks.map((p, i) => (
            <li key={p.id} className="flex min-w-0 max-w-[220px] items-center gap-1.5 rounded-full bg-panel-2 py-1 pl-2 pr-1 text-[13px]">
              <span className={`h-2 w-2 shrink-0 rounded-full ${SERIES[i]}`} aria-hidden="true" />
              <span className="min-w-0 truncate">{p.name}</span>
              <button
                type="button"
                onClick={() => compare.remove(p.id)}
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-line hover:text-ink"
              >
                <XIcon size={12} />
                <span className="sr-only">Remove {p.name}</span>
              </button>
            </li>
          ))}
          {!ready && <li className="px-1 text-[13px] text-ink-3">Pick one more to compare</li>}
        </ul>
        <button type="button" onClick={compare.clear} className="hidden h-9 shrink-0 rounded-full px-3 text-[13px] font-medium text-ink-2 hover:bg-panel-2 sm:block">
          Clear
        </button>
        {ready ? (
          <Link
            href={compareHref(picks.map((p) => p.id))}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 text-[13px] font-semibold text-accent-ink transition hover:bg-accent-hover"
          >
            Compare {picks.length}
          </Link>
        ) : (
          <button type="button" onClick={compare.clear} className="h-9 shrink-0 rounded-full px-3 text-[13px] font-medium text-ink-2 hover:bg-panel-2 sm:hidden">
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
