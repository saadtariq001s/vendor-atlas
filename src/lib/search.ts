import { query, queryOne } from "@/lib/db";
import { getPosition, type Position } from "@/lib/insights";
import { EMIRATES } from "@/lib/normalize";
import { SECTOR_BY_ID, sectorsForQuery } from "@/lib/sectors";

// ── filters ────────────────────────────────────────────────────────────────

export const UNSPECIFIED = "Unspecified";

export const MISSING = { email: "an email", phone: "a phone number", emirate: "a location" } as const;
export type Missing = keyof typeof MISSING;

export type Filters = {
  q: string;
  sector: string | null;
  emirate: string | null;
  activity: string | null;
  missing: Missing | null; // data-quality views on the Manage page
  all: boolean; // the whole directory as one list
};

export type SortKey = "relevance" | "name" | "capabilities" | "recent";
export const SORTS: { key: SortKey; label: string }[] = [
  { key: "relevance", label: "Best match" },
  { key: "name", label: "Name A–Z" },
  { key: "capabilities", label: "Most capabilities" },
  { key: "recent", label: "Recently added" },
];

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || null;

export function parseFilters(sp: Params): Filters {
  const sector = one(sp.sector);
  const emirate = one(sp.emirate);
  const missing = one(sp.missing);
  return {
    q: (one(sp.q) ?? "").slice(0, 120),
    sector: sector && SECTOR_BY_ID.has(sector) ? sector : null,
    emirate:
      emirate && ([...EMIRATES, UNSPECIFIED] as string[]).includes(emirate) ? emirate : null,
    activity: one(sp.activity)?.slice(0, 300) ?? null,
    missing: missing && missing in MISSING ? (missing as Missing) : null,
    all: one(sp.all) === "1",
  };
}

export function parseSort(sp: Params): SortKey {
  const s = one(sp.sort);
  return SORTS.some((x) => x.key === s) ? (s as SortKey) : "relevance";
}

export const hasFilters = (f: Filters) =>
  Boolean(f.q || f.sector || f.emirate || f.activity || f.missing || f.all);

/** Filters as URL search params, dropping empty ones. */
export function filterParams(f: Partial<Filters>, extra: Record<string, string> = {}): URLSearchParams {
  const p = new URLSearchParams();
  for (const k of ["q", "sector", "emirate", "activity", "missing"] as const) {
    const v = f[k];
    if (v) p.set(k, v);
  }
  if (f.all && !f.q && !f.sector && !f.emirate && !f.activity && !f.missing) p.set("all", "1");
  for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
  return p;
}

/** Words the searcher typed, for highlighting matches in the UI. */
export function queryTerms(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !CONNECTORS.has(t));
}

const CONNECTORS = new Set(["and", "or", "the", "of", "in", "for", "with"]);

/**
 * Postgres tsquery text for a free-text search. Tokens are reduced to letters
 * and digits first, so the result is always valid syntax. Words of four or
 * more letters match as prefixes ("constr" finds construction); short ones
 * match exactly so "gas" doesn't also find "gaskets".
 */
function toTsQuery(q: string): string | null {
  const terms = queryTerms(q);
  if (terms.length === 0) return null;
  const lexeme = (t: string) => (t.length >= 4 ? `${t}:*` : t);
  return terms
    .map((t) => {
      const variants = SPELLINGS.find((group) => group.includes(t));
      return variants ? `(${variants.map(lexeme).join(" | ")})` : lexeme(t);
    })
    .join(" & ");
}

// Place names the source data spells several ways.
const SPELLINGS = [
  ["musaffah", "mussafah", "mussaffah", "musafah", "musaffa", "mussafa", "musafa"],
  ["abudhabi", "abu-dhabi"],
  ["jebel", "jabel"],
  ["fujairah", "fujeirah"],
  ["khaimah", "khaima"],
];

type Where = { sql: string; params: unknown[]; rank: string; sectorHits: string[] };

function buildWhere(f: Filters): Where {
  const params: unknown[] = [];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  const and: string[] = [];
  let rank = "0::real"; // a bare 0 in ORDER BY would mean "column 0"
  let sectorHits: string[] = [];

  if (f.q) {
    const tsq = toTsQuery(f.q);
    sectorHits = sectorsForQuery(f.q);
    const any: string[] = [];
    if (tsq) {
      const ref = p(tsq);
      any.push(`v.search @@ to_tsquery('english', ${ref})`);
      rank = `ts_rank_cd(v.search, to_tsquery('english', ${ref}), 32)`;
    }
    if (sectorHits.length) {
      const ref = p(sectorHits);
      any.push(`v.sectors && ${ref}::text[]`);
      rank = `${rank} + case when v.sectors && ${ref}::text[] then 0.25 else 0 end`;
    }
    // A query of only stop words with no sector meaning: match nothing.
    and.push(any.length ? `(${any.join(" or ")})` : "false");
  }
  if (f.sector) and.push(`v.sectors @> array[${p(f.sector)}]::text[]`);
  if (f.emirate === UNSPECIFIED) and.push(`v.emirate is null`);
  else if (f.emirate) and.push(`v.emirate = ${p(f.emirate)}`);
  if (f.activity) and.push(`v.activities @> array[${p(f.activity)}]::text[]`);
  // Fixed column names from a closed set, never user text.
  if (f.missing) and.push(`v.${f.missing} is null`);

  return { sql: and.length ? and.join(" and ") : "true", params, rank, sectorHits };
}

// ── the brief: analytics for one search ────────────────────────────────────

export type Count = { key: string; n: number };

export type Brief = {
  total: number;
  /** Activities held by so much of the directory they say nothing; left out of `activities`. */
  commonActivities: string[];
  directoryTotal: number;
  emirates: Count[];
  sectors: Count[];
  activities: Count[];
  distinctActivities: number;
  withEmail: number;
  withPhone: number;
  withBoth: number;
  sectorHits: string[];
  /** Vendors by how many sectors they work in. */
  structure: { focused: number; broad: number };
  /** Vendors covering the most of this view's top activities. */
  leaders: Leader[];
  /** Activities only one or two vendors in the whole directory offer. */
  thin: { key: string; vendors: { id: number; name: string }[] }[];
};

export type Leader = { id: number; name: string; emirate: string | null; covered: number; activities: number; sectors: number };

/** How many of a view's top activities the leaders are measured against. */
const LEADER_BASIS = 10;

// An activity held by more than this share of the whole directory (the ADNOC
// registration line is on ~40%) is left out of a brief's activity chart,
// unless the search itself is about it.
const COMMON_SHARE = 0.2;

export async function getBrief(f: Filters): Promise<Brief> {
  const w = buildWhere(f);
  const row = await queryOne<
    Omit<Brief, "sectorHits" | "commonActivities" | "activities" | "leaders"> & { activities: (Count & { d: number })[] }
  >(
    `with m as (select v.* from public.vendors v where ${w.sql}),
          acts as (select a, count(*)::int n from m, unnest(m.activities) a group by a)
     select
       (select count(*)::int from m) as "total",
       (select count(*)::int from public.vendors) as "directoryTotal",
       coalesce((select json_agg(x order by x.n desc, x.key) from
         (select coalesce(emirate, '${UNSPECIFIED}') as key, count(*)::int n from m group by 1) x), '[]') as "emirates",
       coalesce((select json_agg(x order by x.n desc, x.key) from
         (select s as key, count(*)::int n from m, unnest(m.sectors) s group by 1) x), '[]') as "sectors",
       coalesce((select json_agg(x order by x.n desc, x.key) from
         (select a as key, n,
                 (select count(*)::int from public.vendors d where d.activities @> array[a]) as d
            from acts order by n desc, a limit 16) x), '[]') as "activities",
       (select count(*)::int from acts) as "distinctActivities",
       (select count(*)::int from m where email is not null) as "withEmail",
       (select count(*)::int from m where phone is not null) as "withPhone",
       (select count(*)::int from m where email is not null and phone is not null) as "withBoth",
       json_build_object(
         'focused', (select count(*)::int from m where cardinality(sectors) <= 1),
         'broad', (select count(*)::int from m where cardinality(sectors) >= 3)) as "structure",
       coalesce((select json_agg(x order by x.key) from
         (select a as key,
                 (select json_agg(json_build_object('id', d.id, 'name', d.name) order by d.name)
                    from public.vendors d where d.activities @> array[a]) as vendors
            from acts
           where n <= 2 and (select count(*) from public.vendors d where d.activities @> array[a]) <= 2
           order by a limit 8) x), '[]') as "thin"`,
    w.params,
  );
  const mentions = queryTerms(f.q).map((t) => new RegExp(`\\b${t}`, "i"));
  const isCommon = (a: Count & { d: number }) =>
    a.d > row!.directoryTotal * COMMON_SHARE &&
    a.key !== f.activity &&
    !mentions.some((re) => re.test(a.key));
  const activities = row!.activities.filter((a) => !isCommon(a)).slice(0, 10).map(({ key, n }) => ({ key, n }));

  // Leaders: who covers the most of the activities that define this view.
  // Only meaningful once there's a field of vendors to lead.
  const basis = activities.slice(0, LEADER_BASIS).map((a) => a.key);
  const leaders =
    row!.total >= 4 && basis.length >= 3
      ? await query<Leader>(
          `select v.id::int, v.name, v.emirate,
                  (select count(*)::int from unnest(v.activities) a where a = any($${w.params.length + 1}::text[])) as covered,
                  cardinality(v.activities)::int as activities, cardinality(v.sectors)::int as sectors
             from public.vendors v where ${w.sql}
            order by covered desc, activities desc, v.name limit 5`,
          [...w.params, basis],
        ).then((rows) => rows.filter((r) => r.covered >= 2))
      : [];

  return {
    ...row!,
    activities,
    commonActivities: row!.activities.filter(isCommon).map((a) => a.key),
    sectorHits: w.sectorHits,
    leaders,
  };
}

// ── listings ───────────────────────────────────────────────────────────────

export type VendorRow = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  emirate: string | null;
  sectors: string[];
  activities: string[];
  created_at: string;
};

const LIST_COLUMNS = `v.id::int, v.name, v.email, v.phone, v.address, v.emirate, v.sectors, v.activities, v.created_at`;

export const PAGE_SIZE = 40;

export async function listVendors(
  f: Filters,
  sort: SortKey,
  offset = 0,
  limit = PAGE_SIZE,
): Promise<VendorRow[]> {
  const w = buildWhere(f);
  const order = {
    relevance: `${w.rank} desc, v.name`,
    name: `lower(v.name)`,
    capabilities: `cardinality(v.activities) desc, v.name`,
    recent: `v.created_at desc, v.id desc`,
  }[sort];
  const params = [...w.params, limit, offset];
  return query<VendorRow>(
    `select ${LIST_COLUMNS} from public.vendors v where ${w.sql}
     order by ${order} limit $${params.length - 1} offset $${params.length}`,
    params,
  );
}

/** Every matching vendor, for export. Capped to keep a runaway export sane. */
export async function exportVendors(f: Filters, sort: SortKey): Promise<VendorRow[]> {
  return listVendors(f, sort, 0, 50_000);
}

// ── when nothing matches ───────────────────────────────────────────────────

/** Closest real word in the directory to a misspelt one-word query. */
export async function didYouMean(q: string): Promise<string | null> {
  const terms = queryTerms(q);
  if (terms.length !== 1 || terms[0].length < 4) return null;
  const row = await queryOne<{ w: string; s: number }>(
    `select w, similarity(w, $1) s
       from (select distinct lower(w) w
               from public.vendors,
                    regexp_split_to_table(coalesce(activities_raw, '') || ' ' || name, '[^A-Za-z]+') w
              where length(w) > 3) t
      where w % $1
      order by s desc, w
      limit 1`,
    [terms[0]],
  );
  return row && row.s >= 0.3 && row.w !== terms[0] ? row.w : null;
}

// ── home ───────────────────────────────────────────────────────────────────

export type Overview = {
  total: number;
  distinctActivities: number;
  sectors: Count[];
  emirates: Count[];
  activities: Count[];
  recent: VendorRow[];
  missingEmail: number;
  missingPhone: number;
  missingEmirate: number;
  lastUpdated: string | null;
};

export async function getOverview(): Promise<Overview> {
  const [row, recent] = await Promise.all([
    queryOne<Omit<Overview, "recent">>(
      `select
         (select count(*)::int from public.vendors) as "total",
         (select count(distinct a)::int from public.vendors, unnest(activities) a) as "distinctActivities",
         coalesce((select json_agg(x order by x.n desc, x.key) from
           (select s as key, count(*)::int n from public.vendors, unnest(sectors) s group by 1) x), '[]') as "sectors",
         coalesce((select json_agg(x order by x.n desc, x.key) from
           (select coalesce(emirate, '${UNSPECIFIED}') as key, count(*)::int n from public.vendors group by 1) x), '[]') as "emirates",
         coalesce((select json_agg(x order by x.n desc, x.key) from
           (select a as key, count(*)::int n from public.vendors, unnest(activities) a
             group by 1 order by 2 desc, 1 limit 10) x), '[]') as "activities",
         (select count(*)::int from public.vendors where email is null) as "missingEmail",
         (select count(*)::int from public.vendors where phone is null) as "missingPhone",
         (select count(*)::int from public.vendors where emirate is null) as "missingEmirate",
         (select max(updated_at) from public.vendors) as "lastUpdated"`,
    ),
    query<VendorRow>(
      `select ${LIST_COLUMNS} from public.vendors v order by v.created_at desc, v.id desc limit 6`,
    ),
  ]);
  return { ...row!, recent };
}

// ── one vendor ─────────────────────────────────────────────────────────────

export type VendorDetail = VendorRow & {
  activities_raw: string | null;
  emirate_source: string | null;
  notes: string | null;
  activity_codes: Record<string, string>;
  associates: { name: string; country: string | null }[];
  sources: string[];
  name_cut: boolean;
  updated_at: string;
  position: Position;
};

export async function getVendor(id: number): Promise<VendorDetail | null> {
  const v = await queryOne<Omit<VendorDetail, "position">>(
    `select ${LIST_COLUMNS}, v.activities_raw, v.emirate_source, v.notes, v.activity_codes, v.associates, v.sources, v.name_cut, v.updated_at
       from public.vendors v where v.id = $1`,
    [id],
  );
  if (!v) return null;
  const position = await getPosition(id, v.activities, v.sectors);
  return { ...v, position };
}

