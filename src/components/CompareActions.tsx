"use client";

import Link from "next/link";
import { compare, type Pick } from "@/lib/compare-store";

/** Under the Compare headline: change the selection, or start again. */
export function CompareActions({ vendors }: { vendors: Pick[] }) {
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      <Link
        href="/"
        onClick={() => {
          // Carry this set into the tray so one more can be added from a search.
          compare.clear();
          vendors.forEach((v) => compare.add(v));
        }}
        className="flex h-10 items-center rounded-full border border-line-strong bg-panel px-4 text-[14px] font-medium text-ink transition hover:border-ink"
      >
        Add another vendor
      </Link>
      <Link
        href="/compare"
        onClick={() => compare.clear()}
        className="flex h-10 items-center rounded-full px-4 text-[14px] font-medium text-ink-2 transition hover:bg-panel-2 hover:text-ink"
      >
        Start again
      </Link>
    </div>
  );
}
