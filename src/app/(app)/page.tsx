import type { Metadata } from "next";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { fmt, fmtDate, headlineCase, pct, plural } from "@/lib/format";
import type { AppUser } from "@/lib/auth";
import {
  MISSING,
  PAGE_SIZE,
  UNSPECIFIED,
  didYouMean,
  filterParams,
  getBrief,
  getOverview,
  hasFilters,
  listVendors,
  parseFilters,
  parseSort,
  queryTerms,
  type Brief,
  type Filters,
  type Overview,
  type SortKey,
  type VendorRow,
} from "@/lib/search";
import { SECTORS, SECTOR_BY_ID } from "@/lib/sectors";
import { BarList, type Bar } from "@/components/BarList";
import { SearchHero } from "@/components/SearchHero";
import { Leaders } from "@/components/Leaders";
import { VendorList } from "@/components/VendorList";

type SP = Promise<Record<string, string | string[] | undefined>>;

/** What a set of filters is about, in words: the page headline. */
function titleFor(f: Filters): string {
  if (f.q) return headlineCase(f.q);
  if (f.activity) return f.activity;
  if (f.sector) return SECTOR_BY_ID.get(f.sector)!.name;
  if (f.emirate) return f.emirate === UNSPECIFIED ? "Location not recorded" : f.emirate;
  if (f.missing) return `Missing ${MISSING[f.missing]}`;
  return "All vendors";
}

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const f = parseFilters(await searchParams);
  return hasFilters(f) ? { title: titleFor(f) } : {};
}

export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const searching = hasFilters(filters);

  // The search box is rendered here, in the same place for home and results,
  // so moving between them (as someone types) keeps it mounted and focused.
  let total: number;
  let body: React.ReactNode;
  if (!searching) {
    const o = await getOverview();
    if (o.total === 0) return <Empty />;
    total = o.total;
    body = <HomeBody o={o} />;
  } else {
    const sort = parseSort(sp);
    const [brief, rows, user] = await Promise.all([getBrief(filters), listVendors(filters, sort), getUser()]);
    const suggestion = brief.total === 0 && filters.q ? await didYouMean(filters.q) : null;
    total = brief.directoryTotal;
    body = <Results f={filters} sort={sort} brief={brief} rows={rows} user={user} suggestion={suggestion} />;
  }

  return (
    <>
      <SearchHero query={filters.q ?? ""} total={total} hero={!searching} examples={TRY} />
      {body}
    </>
  );
}

// ── shared pieces ──────────────────────────────────────────────────────────

const WRAP = "mx-auto max-w-[1280px] px-4 sm:px-6 md:px-8";

/** A section of the page: a serif heading, an optional note, and content. */
function Section({ title, note, aside, children }: { title: string; note?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="title text-[26px] text-ink md:text-[30px]">{title}</h2>
        {aside}
      </div>
      {note && <p className="mt-1 max-w-2xl text-[14px] text-ink-3">{note}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** A heading and content for the narrow insights column. */
function RailBlock({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="card min-w-0 p-5">
      <h2 className="title text-[21px] text-ink">{title}</h2>
      {note && <p className="mt-0.5 text-[13px] leading-snug text-ink-3">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const TRY = ["construction", "catering", "valves", "IT", "scaffolding", "offshore"];

const chip =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line-strong bg-panel px-3 py-1.5 text-[13px] text-ink-2 transition hover:border-ink hover:text-ink";

// ── home ───────────────────────────────────────────────────────────────────

async function Empty() {
  const user = await getUser();
  return (
    <div className="wash">
      <div className={`${WRAP} py-20 md:py-28`}>
        <h1 className="headline text-[48px] sm:text-[64px] lg:text-[84px]">
          Your directory is <em>empty</em>.
        </h1>
        <p className="mt-5 max-w-xl text-[17px] text-ink-2">
          {user?.role === "admin"
            ? "Upload your vendor spreadsheets to start searching them."
            : "Ask an administrator to upload the vendor spreadsheets."}
        </p>
        {user?.role === "admin" && (
          <Link href="/upload" className="mt-8 inline-flex h-12 items-center rounded-full bg-accent px-6 text-[15px] font-semibold text-accent-ink hover:bg-accent-hover">
            Upload spreadsheets
          </Link>
        )}
      </div>
    </div>
  );
}

function HomeBody({ o }: { o: Overview }) {
  const sectorBars: Bar[] = o.sectors.map((s) => ({
    key: s.key,
    label: SECTOR_BY_ID.get(s.key)?.name ?? s.key,
    n: s.n,
    href: `/?sector=${s.key}`,
  }));
  const figures = [
    { value: fmt(o.total), label: "vendors" },
    { value: fmt(o.sectors.length), label: "sectors covered" },
    { value: fmt(o.distinctActivities), label: "distinct offerings" },
  ];

  return (
    <main id="results" className={`${WRAP} space-y-14 pb-28 pt-12 md:space-y-20 md:pt-20`}>
      <div id="directory" className="scroll-mt-24" />
      <Section
        title="The directory today"
        aside={o.lastUpdated && <p className="text-[14px] text-ink-3">Last updated {fmtDate(o.lastUpdated)}</p>}
      >
        <dl className="grid grid-cols-3 divide-x divide-line border-y border-line">
          {figures.map((f) => (
            <div key={f.label} className="flex flex-col-reverse px-3 py-5 first:pl-0 md:px-8 md:py-7 md:first:pl-0">
              <dt className="mt-1 text-[13px] text-ink-2 md:text-[15px]">{f.label}</dt>
              <dd className="title num text-[30px] leading-none text-ink sm:text-[44px] md:text-[60px]">{f.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-10">
          <h3 className="text-[15px] font-semibold text-ink">Every sector</h3>
          <p className="mt-0.5 text-[14px] text-ink-3">Vendors count in every sector they work in. Open one to see who&apos;s in it and who leads it.</p>
          <div className="mt-4">
            <BarList bars={sectorBars} total={o.total} limit={20} columns={2} />
          </div>
        </div>
      </Section>

      <div className="grid gap-12 border-t border-line pt-12 md:gap-14 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Section title="Most common offerings" note="The registered activities that appear most often across the directory.">
          <BarList
            bars={o.activities.map((a) => ({ key: a.key, label: a.key, n: a.n, href: `/?activity=${encodeURIComponent(a.key)}` }))}
            total={o.total}
            limit={10}
          />
        </Section>
        <Section title="Recently added">
          <ul className="divide-y divide-line border-y border-line">
            {o.recent.map((v) => (
              <li key={v.id}>
                <Link href={`/?v=${v.id}`} scroll={false} className="-mx-2 block truncate rounded-lg px-2 py-3 text-[15px] font-medium text-ink hover:bg-panel-2">
                  {v.name}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/?all=1&sort=recent" className="mt-4 inline-block text-[14px] font-medium text-accent-text hover:underline">
            See everything, newest first
          </Link>
        </Section>
      </div>
    </main>
  );
}

// ── results: one search, analysed ──────────────────────────────────────────

function Results({
  f,
  sort,
  brief,
  rows,
  user,
  suggestion,
}: {
  f: Filters;
  sort: SortKey;
  brief: Brief;
  rows: VendorRow[];
  user: AppUser | null;
  suggestion: string | null;
}) {
  const terms = queryTerms(f.q);
  const title = titleFor(f);

  // What defines this view, so it isn't repeated as a filter chip.
  const primary: keyof Filters = f.q ? "q" : f.activity ? "activity" : f.sector ? "sector" : f.emirate ? "emirate" : f.missing ? "missing" : "all";
  const href = (change: Partial<Filters>) => {
    const qs = filterParams({ ...f, ...change }).toString();
    return qs ? `/?${qs}` : "/";
  };
  const params = filterParams(f).toString();

  // Filters on top of the search, each removable.
  const active: { label: string; href: string }[] = [];
  if (f.sector && primary !== "sector") active.push({ label: SECTOR_BY_ID.get(f.sector)!.name, href: href({ sector: null }) });
  if (f.activity && primary !== "activity") active.push({ label: f.activity, href: href({ activity: null }) });
  if (f.missing && primary !== "missing") active.push({ label: `Missing ${MISSING[f.missing]}`, href: href({ missing: null }) });
  const narrowTo = f.activity ? [] : brief.activities.slice(0, 8);

  const expanded = brief.sectorHits.map((s) => SECTOR_BY_ID.get(s)!.name.toLowerCase());
  const lead = (() => {
    const share = `${pct(brief.total, brief.directoryTotal)} of your directory`;
    if (primary === "q") return expanded.length ? `${share}, including everyone classed under ${expanded.join(" and ")}.` : `${share}.`;
    if (primary === "activity") return `Registered for this activity, ${share}.`;
    if (primary === "sector") return `Working in this sector, ${share}.`;
    if (primary === "missing") return `${share}. Open one to fill it in.`;
    return "Everything in your directory.";
  })();
  const otherSectors = brief.sectors.filter((s) => !brief.sectorHits.includes(s.key) && s.key !== f.sector);

  if (brief.total === 0) {
    return (
      <main id="results" className={`${WRAP} pb-28 pt-10`}>
        <div className="px-2 py-12 text-center md:py-16">
          <h1 className="title text-[30px]">No vendors match {f.q ? `“${f.q}”` : "these filters"}.</h1>
          {suggestion ? (
            <p className="mt-3 text-[16px] text-ink-2">
              Did you mean{" "}
              <Link href={`/?q=${encodeURIComponent(suggestion)}`} scroll={false} className="font-semibold text-accent-text underline underline-offset-4">
                {suggestion}
              </Link>
              ?
            </p>
          ) : (
            <p className="mt-3 text-[16px] text-ink-2">Try a shorter or broader word, or start from a sector.</p>
          )}
          <div className="mx-auto mt-8 flex max-w-2xl flex-wrap justify-center gap-2">
            {SECTORS.slice(0, 8).map((s) => (
              <Link key={s.id} href={`/?sector=${s.id}`} scroll={false} className={chip}>
                {s.name}
              </Link>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main id="results" className={`${WRAP} pb-28 pt-6 md:pt-8`}>
      <header>
        <h1 className="title text-[34px] leading-tight text-ink md:text-[46px]">
          <span className="num">{plural(brief.total, "vendor")}</span>
          {primary !== "all" && (
            <>
              <span className="text-ink-3"> {primary === "q" ? "for" : "in"} </span>
              <em className="text-accent-text">{primary === "q" ? `“${title}”` : title}</em>
            </>
          )}
        </h1>
        <p className="mt-2 max-w-3xl text-[16px] text-ink-2">{lead}</p>

        {(active.length > 0 || narrowTo.length > 0) && (
          <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
            {active.map((c) => (
              <Link key={c.label} href={c.href} scroll={false} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink py-1.5 pl-3 pr-2 text-[13px] font-medium text-panel transition hover:bg-ink-2">
                <span className="max-w-[260px] truncate">{c.label}</span>
                <span aria-hidden="true" className="text-[15px] leading-none opacity-70">×</span>
                <span className="sr-only">Remove this filter</span>
              </Link>
            ))}
            {narrowTo.length > 0 && <span className="shrink-0 self-center pl-1 pr-1 text-[13px] text-ink-3">Narrow to</span>}
            {narrowTo.map((a) => (
              <Link key={a.key} href={href({ activity: a.key })} scroll={false} className={chip}>
                <span className="max-w-[280px] truncate">{a.key}</span>
                <span className="num text-ink-3">{fmt(a.n)}</span>
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* Phone: the overview, the list, then the rest. Wide screens: the list
          on the left, insights in a column on the right. */}
      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:grid-rows-[auto_1fr] xl:gap-x-10">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-2 xl:col-start-2 xl:row-start-1 xl:grid-cols-[minmax(0,1fr)] xl:content-start">
          <RailBlock title="At a glance">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
              {[
                { v: fmt(brief.distinctActivities), l: "distinct offerings" },
                { v: pct(brief.structure.focused, brief.total), l: "focused on one field" },
                { v: pct(brief.withBoth, brief.total), l: "reachable by email and phone" },
                { v: pct(brief.structure.broad, brief.total), l: "span three sectors or more" },
              ].map((s) => (
                <div key={s.l} className="flex flex-col-reverse">
                  <dt className="mt-0.5 text-[12px] leading-snug text-ink-3">{s.l}</dt>
                  <dd className="title num text-[26px] leading-none text-ink">{s.v}</dd>
                </div>
              ))}
            </dl>
          </RailBlock>
          <RailBlock title="Most complete offering" note="Who covers the most of what this search is about.">
            <Leaders leaders={brief.leaders.slice(0, 5)} basis={Math.min(brief.activities.length, 10)} params={params} />
          </RailBlock>
        </div>

        <div className="min-w-0 xl:col-start-1 xl:row-span-2 xl:row-start-1">
          <VendorList
            key={`${params}|${sort}`}
            initialRows={rows}
            total={brief.total}
            params={params}
            sort={sort}
            terms={terms}
            pageSize={PAGE_SIZE}
            isAdmin={user?.role === "admin"}
          />
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-2 xl:col-start-2 xl:row-start-2 xl:grid-cols-[minmax(0,1fr)] xl:content-start">
          {otherSectors.length > 0 && (
            <RailBlock title="Also active in">
              <div className="flex flex-wrap gap-2">
                {otherSectors.slice(0, 10).map((s) => (
                  <Link key={s.key} href={href({ sector: s.key })} scroll={false} className={chip}>
                    {SECTOR_BY_ID.get(s.key)?.name ?? s.key} <span className="num text-ink-3">{fmt(s.n)}</span>
                  </Link>
                ))}
              </div>
            </RailBlock>
          )}
          {brief.thin.length > 0 && (
            <RailBlock title="Thin supply" note="Offered here by only one or two vendors in the whole directory.">
              <ul className="divide-y divide-line">
                {brief.thin.slice(0, 5).map((t) => (
                  <li key={t.key} className="py-2.5 first:pt-0 last:pb-0">
                    <p className="line-clamp-2 text-[14px] leading-snug text-ink">{t.key}</p>
                    <p className="mt-0.5 text-[13px] text-ink-3">
                      {t.vendors.length === 1 ? "Only " : "Just "}
                      {t.vendors.map((v, i) => (
                        <span key={v.id}>
                          {i > 0 && " and "}
                          <Link href={`/?${params}&v=${v.id}`} scroll={false} className="font-medium text-accent-text hover:underline">
                            {v.name}
                          </Link>
                        </span>
                      ))}
                    </p>
                  </li>
                ))}
              </ul>
            </RailBlock>
          )}
        </div>
      </div>
    </main>
  );
}
