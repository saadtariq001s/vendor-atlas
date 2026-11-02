import Link from "next/link";
import { fmt, pct } from "@/lib/format";

export type Bar = { key: string; label: string; n: number; href: string; strong?: boolean };

/**
 * A ranked list with one thin bar per row: a single series, so one colour
 * and no legend. Bars are scaled to the largest row; every value is printed,
 * so the tooltip only adds the share. Each row narrows the search.
 */
export function BarList({
  title,
  note,
  bars,
  total,
  limit = 7,
  footnote,
  empty = "Nothing to show.",
  columns = 1,
}: {
  /** Optional: when the list isn't already under a section heading. */
  title?: string;
  note?: string;
  bars: Bar[];
  total: number;
  limit?: number;
  footnote?: React.ReactNode;
  empty?: string;
  /** Two columns on wide screens, for long lists in a full-width panel. */
  columns?: 1 | 2;
}) {
  const max = Math.max(1, ...bars.map((b) => b.n));
  const row = (b: Bar, i: number) => (
    <li key={b.key}>
      <Link
        href={b.href}
        scroll={false}
        aria-label={`${b.label}: ${fmt(b.n)}. Show only these.`}
        className="tip group -mx-2 block rounded-lg px-2 py-1.5 transition-colors hover:bg-panel-2"
      >
        <span className="flex items-baseline justify-between gap-4 text-[14px] leading-snug">
          <span className={`line-clamp-2 text-ink group-hover:text-accent-text ${b.strong ? "font-semibold" : ""}`}>
            {b.label}
          </span>
          <span className="num shrink-0 text-ink-2">{fmt(b.n)}</span>
        </span>
        <span className="mt-1.5 block h-1.5">
          <span
            className="bar-fill block"
            style={{ width: `${Math.max(1.5, (b.n / max) * 100)}%`, ["--i" as string]: i }}
          />
        </span>
        <span role="tooltip">
          {fmt(b.n)} {b.n === 1 ? "vendor" : "vendors"}, {pct(b.n, total)} of {fmt(total)}
        </span>
      </Link>
    </li>
  );

  return (
    <section className="min-w-0">
      {title && <h3 className="title text-[20px] text-ink">{title}</h3>}
      {note && <p className="mt-0.5 text-[13px] text-ink-3">{note}</p>}
      {bars.length === 0 ? (
        <p className={`${title ? "mt-4" : ""} text-[14px] text-ink-3`}>{empty}</p>
      ) : (
        <>
          <ol className={`${title ? "mt-3" : ""} ${columns === 2 ? "gap-x-12 lg:columns-2 [&>li]:break-inside-avoid [&>li]:pb-1" : "space-y-1"}`}>
            {bars.slice(0, limit).map(row)}
          </ol>
          {bars.length > limit && (
            <details className="group/more">
              <summary className="mt-2 cursor-pointer list-none text-[13px] font-medium text-accent-text hover:underline group-open/more:hidden">
                Show {bars.length - limit} more
              </summary>
              <ol className="space-y-1">{bars.slice(limit).map((b, i) => row(b, i + limit))}</ol>
            </details>
          )}
        </>
      )}
      {footnote}
    </section>
  );
}
