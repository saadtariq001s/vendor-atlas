"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { ChevronDownIcon, SearchIcon, XIcon } from "./icons";

const LIVE_DELAY = 280; // ms after the last keystroke

// Wide enough for the long placeholder (it's cut off on a phone).
const WIDE = "(min-width: 640px)";
const watchWide = (cb: () => void) => {
  const m = matchMedia(WIDE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

/**
 * The one search box, on the home page and above every result. It stays
 * mounted while results change underneath it, so typing updates the page
 * live (no Enter needed) without the box losing focus. On the home page it
 * sits under the headline; once there's a result, the headline folds away and
 * the box moves up to the top.
 */
export function SearchHero({
  query,
  total,
  hero,
  examples,
}: {
  query: string; // the search currently shown ("" on home or a sector page)
  total: number;
  hero: boolean; // home page: show the headline and examples
  examples: string[];
}) {
  const router = useRouter();
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(query);
  const [pending, startTransition] = useTransition();
  const wide = useSyncExternalStore(watchWide, () => matchMedia(WIDE).matches, () => true);

  // When the shown search changes from elsewhere (an example, a link, Back),
  // show it in the box. Changes this box asked for are left alone, so a slow
  // answer never overwrites what's been typed since.
  const [sent, setSent] = useState<string | null>(null);
  const [seen, setSeen] = useState(query);
  if (query !== seen) {
    setSeen(query);
    if (query !== sent) setValue(query);
  }

  // Search as you type.
  useEffect(() => {
    const q = value.trim();
    if (q === query || q.length === 1) return; // already shown, or wait for a second letter
    const t = setTimeout(() => {
      setSent(q);
      const url = q ? `/?q=${encodeURIComponent(q)}` : "/";
      // The first search from home is a step Back can undo; refinements aren't.
      startTransition(() => (query ? router.replace(url, { scroll: false }) : router.push(url, { scroll: false })));
    }, LIVE_DELAY);
    return () => clearTimeout(t);
  }, [value, query, router]);

  // Dim the results while the next ones are on their way.
  useEffect(() => {
    document.getElementById("results")?.setAttribute("data-pending", String(pending));
  }, [pending]);

  // Ready to type on a desktop home page (not on phones: the keyboard would
  // cover the page). "/" or Ctrl/⌘ K focuses it from anywhere.
  useEffect(() => {
    if (hero && matchMedia("(pointer: fine)").matches) ref.current?.focus({ preventScroll: true });
  }, [hero]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest("input, textarea, select, [contenteditable]");
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
        ref.current?.focus({ preventScroll: true });
        ref.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = () => {
    const q = value.trim();
    ref.current?.blur(); // closes the phone keyboard so the results show
    if (q === query) return;
    setSent(q);
    startTransition(() => router.push(q ? `/?q=${encodeURIComponent(q)}` : "/", { scroll: false }));
  };

  return (
    <div
      className={`relative flex scroll-mt-[65px] flex-col overflow-hidden transition-[min-height] duration-500 ${hero ? "hero-stage border-b border-line" : "wash"}`}
      // The whole first screen under the header on the home page.
      style={{ minHeight: hero ? "calc(100svh - 4rem - env(safe-area-inset-top))" : "0px" }}
    >
      <Globe shown={hero} />
      <div
        className={`relative mx-auto flex w-full max-w-[1280px] flex-1 flex-col justify-center px-4 transition-[padding] duration-500 sm:px-6 md:px-8 ${
          hero ? "py-12 md:py-16" : "pb-2 pt-6 md:pt-8"
        }`}
      >
        {/* Folds away when there's a result to show. */}
        <div className={`fold ${hero ? "" : "fold-shut"}`} aria-hidden={!hero}>
          <div>
            <h1 className="headline max-w-4xl text-[44px] min-[400px]:text-[50px] sm:text-[68px] md:text-[80px] lg:text-[104px] xl:text-[112px]">
              Every vendor you know, <em>in a word</em>.
            </h1>
            <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink-2 sm:text-[18px] md:mt-7 md:text-[20px]">
              Start typing. Results appear as you go: who&apos;s in it, who leads, and who to compare.
            </p>
          </div>
        </div>

        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            go();
          }}
          className={`relative max-w-3xl transition-[margin] duration-500 ${hero ? "mt-8 md:mt-12" : "mt-0"}`}
        >
          <label htmlFor={id} className="sr-only">
            Search the directory
          </label>
          <div className="flex items-center gap-2 rounded-full border border-line bg-panel p-1.5 pl-5 shadow-[var(--shadow-card)] transition focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/10">
            <SearchIcon size={20} className="shrink-0 text-ink-3" />
            <input
              id={id}
              ref={ref}
              type="search"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setValue("");
                  ref.current?.blur();
                }
              }}
              placeholder={wide ? `Search ${total.toLocaleString("en-US")} vendors by sector, service or name` : "Search vendors"}
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
              className="h-11 min-w-0 flex-1 bg-transparent text-[17px] text-ink outline-none placeholder:text-ink-3 md:text-[18px] [&::-webkit-search-cancel-button]:hidden"
            />
            {value && (
              <button
                type="button"
                onClick={() => {
                  setValue("");
                  ref.current?.focus();
                }}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-3 transition hover:bg-panel-2 hover:text-ink"
              >
                <XIcon size={18} />
                <span className="sr-only">Clear the search</span>
              </button>
            )}
            <button
              type="submit"
              className="h-11 shrink-0 rounded-full bg-accent px-5 text-[15px] font-semibold text-accent-ink transition hover:bg-accent-hover"
            >
              Search
            </button>
          </div>
          {/* Thin progress line while results load. */}
          <div className="absolute inset-x-6 -bottom-2 h-0.5 overflow-hidden rounded-full" aria-hidden="true">
            <div className={`h-full rounded-full bg-accent transition-all ease-out ${pending ? "w-4/5 duration-[1500ms]" : "w-0 duration-0"}`} />
          </div>
          <p className="sr-only" aria-live="polite">
            {pending ? "Searching" : ""}
          </p>
        </form>

        <div className={`fold ${hero ? "" : "fold-shut"}`} aria-hidden={!hero}>
          <div>
            <div className="flex flex-wrap items-center gap-2 pt-5 text-[14px]">
              <span className="mr-1 text-ink-3">Try</span>
              {examples.map((t) => (
                <Link
                  key={t}
                  href={`/?q=${encodeURIComponent(t)}`}
                  scroll={false}
                  tabIndex={hero ? undefined : -1}
                  className="rounded-full border border-line-strong bg-panel/60 px-3 py-1 text-ink-2 transition hover:border-ink hover:text-ink"
                >
                  {t}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {hero && (
        <a
          href="#directory"
          className="relative mx-auto mb-5 flex w-full max-w-[1280px] items-center gap-2 px-4 text-[14px] font-medium text-ink-2 transition hover:text-ink sm:px-6 md:mb-8 md:px-8"
        >
          <ChevronDownIcon size={18} className="text-accent-text" />
          See the directory
        </a>
      )}
    </div>
  );
}

/**
 * A line-drawn globe behind the home headline: the "atlas" in the name.
 * Meridians and parallels in faint ink, a few vendors marked in the accent.
 */
function Globe({ shown }: { shown: boolean }) {
  const R = 96;
  const meridians = [0, 15, 30, 45, 60, 75].map((a) => R * Math.cos((a * Math.PI) / 180));
  const parallels = [-60, -40, -20, 0, 20, 40, 60].map((lat) => {
    const r = (lat * Math.PI) / 180;
    return { y: R * Math.sin(r), rx: R * Math.cos(r) };
  });
  const dots: [number, number][] = [[-38, -30], [22, -52], [55, 8], [-12, 34], [70, -28], [8, 2], [-62, 18], [36, 58]];
  return (
    <svg
      viewBox="-100 -100 200 200"
      aria-hidden="true"
      className={`pointer-events-none absolute transition-opacity duration-500 ${shown ? "opacity-100" : "opacity-0"}
        -bottom-28 -right-36 h-[440px] w-[440px]
        sm:-bottom-32 sm:-right-40 sm:h-[560px] sm:w-[560px]
        lg:-right-24 lg:bottom-auto lg:top-1/2 lg:h-[720px] lg:w-[720px] lg:-translate-y-1/2
        xl:right-0`}
    >
      <g fill="none" stroke="var(--ink)" strokeOpacity="0.1" strokeWidth="1" vectorEffect="non-scaling-stroke">
        <circle r={R} vectorEffect="non-scaling-stroke" />
        {meridians.map((rx) => (
          <ellipse key={rx} rx={rx} ry={R} vectorEffect="non-scaling-stroke" />
        ))}
        {parallels.map((p) => (
          <ellipse key={p.y} cy={p.y} rx={p.rx} ry={p.rx * 0.16} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
      <g fill="var(--accent)">
        {dots.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === 5 ? 2.4 : 1.5} opacity={i === 5 ? 1 : 0.55} />
        ))}
        <circle cx={8} cy={2} r={6} fill="none" stroke="var(--accent)" strokeOpacity="0.35" vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
}
