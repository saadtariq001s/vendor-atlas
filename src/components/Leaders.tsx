import Link from "next/link";
import { plural } from "@/lib/format";
import type { Leader } from "@/lib/search";
import { CompareButton } from "./CompareTray";

/**
 * The vendors covering the most of a search's defining activities. The bar
 * is their coverage out of `basis`; their total offering is printed beside
 * it so breadth is visible too. Three on a phone, all of them from xl up.
 */
export function Leaders({ leaders, basis, params }: { leaders: Leader[]; basis: number; params: string }) {
  if (leaders.length === 0) {
    return <p className="text-[14px] text-ink-3">Too few vendors here to rank. Try a broader search.</p>;
  }
  return (
    <ol className="divide-y divide-line [&>li:nth-child(n+4)]:hidden xl:[&>li:nth-child(n+4)]:block">
      {leaders.map((l, i) => (
        <li key={l.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex items-center gap-2">
            <Link href={`/?${params}&v=${l.id}`} scroll={false} className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink hover:text-accent-text">
              {l.name}
            </Link>
            <CompareButton id={l.id} name={l.name} size="sm" />
          </div>
          <div className="mt-1.5 flex items-center gap-3">
            <span className="bar-track block w-24 shrink-0 overflow-hidden rounded-r">
              <span className="bar-fill block" style={{ width: `${(l.covered / basis) * 100}%`, ["--i" as string]: i }} />
            </span>
            <span className="num whitespace-nowrap text-[12px] text-ink-2">
              {l.covered} of {basis}
              <span className="text-ink-3">, {plural(l.activities, "offering")} in all</span>
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}
