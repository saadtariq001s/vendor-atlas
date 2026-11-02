import { query, queryOne } from "@/lib/db";
import { SECTOR_BY_ID } from "@/lib/sectors";

// ─────────────────────────────────────────────────────────────
// Vendor intelligence: how one vendor sits against its peers, and how
// several vendors compare. Everything is computed from the registered
// activities, weighted by how rare each activity is in the directory
// (an offering only three vendors have says far more about similarity
// than one that two thousand vendors share).
// ─────────────────────────────────────────────────────────────

/** How many vendors in the directory offer each activity. */
const FREQ = `freq as (select a, count(*)::float n from public.vendors, unnest(activities) a group by a)`;
const TOTAL = `tot as (select count(*)::float n from public.vendors)`;

/** An activity is "specific" when fewer than this share of the directory offers it. */
const SPECIFIC_SHARE = 0.15;
/** An activity is "distinctive" when at most this share of the directory offers it. */
const RARE_SHARE = 0.01;
/** A gap is worth mentioning when at least this share of the peer group offers it. */
const GAP_SHARE = 0.2;

export type Named = { id: number; name: string; emirate: string | null };

export type Position = {
  /** The most specific sector the vendor works in, and how many vendors share it. */
  peers: { sector: string; name: string; n: number } | null;
  breadth: { mine: number; median: number; percentile: number } | null;
  /** Offerings held by almost no one else, with the number of vendors who have them. */
  distinctive: { key: string; n: number }[];
  /** Offerings common among peers that this vendor doesn't list, with the peer share. */
  gaps: { key: string; share: number }[];
  /** Closest vendors by rarity-weighted overlap of offerings. */
  competitors: (Named & { similarity: number; shared: number })[];
};

/**
 * The sector a vendor's work is mostly about: the one whose rules match the
 * most of its activities (ties go to the smaller, more specific sector). A
 * conglomerate with one clinic among forty oil-field services is an oil &
 * gas peer, not a healthcare one.
 */
async function peerSector(sectors: string[], activities: string[]): Promise<Position["peers"]> {
  if (sectors.length === 0) return null;
  const sizes = await query<{ s: string; n: number }>(
    `select s, count(*)::int n from public.vendors, unnest(sectors) s where s = any($1::text[]) group by s`,
    [sectors],
  );
  const size = new Map(sizes.map((r) => [r.s, r.n]));
  const best = sectors
    .map((id) => {
      const sector = SECTOR_BY_ID.get(id);
      const hits = sector ? activities.filter((a) => sector.pattern.test(a)).length : 0;
      return { id, hits, n: size.get(id) ?? 0 };
    })
    .sort((a, b) => b.hits - a.hits || a.n - b.n)[0];
  return best ? { sector: best.id, name: SECTOR_BY_ID.get(best.id)?.name ?? best.id, n: best.n } : null;
}

export async function getPosition(id: number, activities: string[], sectors: string[]): Promise<Position> {
  const peers = await peerSector(sectors, activities);

  const [breadth, distinctive, gaps, competitors] = await Promise.all([
    peers
      ? queryOne<{ median: number; below: number; n: number }>(
          `select percentile_cont(0.5) within group (order by cardinality(activities))::float as median,
                  count(*) filter (where cardinality(activities) < $2)::int as below,
                  count(*)::int as n
             from public.vendors where sectors @> array[$1]::text[]`,
          [peers.sector, activities.length],
        ).then((r) =>
          r && r.n > 1 ? { mine: activities.length, median: Math.round(r.median), percentile: Math.round((r.below / (r.n - 1)) * 100) } : null,
        )
      : Promise.resolve(null),

    activities.length
      ? query<{ key: string; n: number }>(
          `with ${TOTAL}
           select a as key, count(*)::int n from public.vendors, unnest(activities) a, tot
            where a = any($1::text[]) group by a, tot.n
           having count(*) <= greatest(2, tot.n * ${RARE_SHARE})
            order by n asc, a limit 6`,
          [activities],
        )
      : Promise.resolve([]),

    peers
      ? query<{ key: string; share: number }>(
          `with p as (select activities from public.vendors where sectors @> array[$1]::text[] and id <> $2),
                n as (select count(*)::float n from p)
           select a as key, round(count(*) / n.n * 100)::int as share
             from p, unnest(p.activities) a, n
            where not (a = any($3::text[]))
            group by a, n.n
           having count(*) >= n.n * ${GAP_SHARE}
            order by share desc, a limit 6`,
          [peers.sector, id, activities],
        )
      : Promise.resolve([]),

    activities.length ? closest(id, activities, 5) : Promise.resolve([]),
  ]);

  return { peers, breadth, distinctive, gaps, competitors };
}

/**
 * The vendors whose offerings overlap most with the given list: a Jaccard
 * index where each activity is weighted by log(directory / holders), so a
 * rare shared offering counts for far more than a common one. Candidates
 * must share at least one specific activity.
 */
export async function closest(id: number, activities: string[], limit: number) {
  const rows = await query<Named & { shared_w: number; shared: number; other_w: number; mine_w: number }>(
    `with ${FREQ}, ${TOTAL},
          mine as (select a, ln(tot.n / f.n) w, f.n from unnest($2::text[]) a join freq f using (a), tot),
          spec as (select coalesce(array_agg(a), '{}') a from mine, tot where mine.n <= tot.n * ${SPECIFIC_SHARE})
     select o.id::int, o.name, o.emirate,
            (select coalesce(sum(w), 0) from mine where mine.a = any(o.activities))::float as shared_w,
            (select count(*) from mine where mine.a = any(o.activities))::int as shared,
            (select coalesce(sum(ln(tot.n / f.n)), 0) from unnest(o.activities) oa join freq f on f.a = oa, tot
              where not (oa = any($2::text[])))::float as other_w,
            (select sum(w) from mine)::float as mine_w
       from public.vendors o, spec
      where o.id <> $1 and o.activities && spec.a
      order by shared_w desc
      limit 60`,
    [id, activities],
  );
  return rows
    .map(({ shared_w, other_w, mine_w, ...r }) => ({
      ...r,
      similarity: Math.round((shared_w / (mine_w + other_w)) * 100),
    }))
    .sort((a, b) => b.similarity - a.similarity || b.shared - a.shared || a.name.localeCompare(b.name))
    .slice(0, limit);
}

// ── compare ────────────────────────────────────────────────────────────────

export const COMPARE_MAX = 4;

export type CompareVendor = Named & {
  sectors: string[];
  activities: string[];
  email: string | null;
  phone: string | null;
  address: string | null;
  associates: { name: string; country: string | null }[];
  peers: Position["peers"];
  /** Offerings that fewer than 1% of the directory have. */
  rare: number;
};

export type CompareRow = {
  key: string;
  /** How many vendors in the whole directory offer it. */
  n: number;
  has: boolean[];
};

export type Comparison = {
  vendors: CompareVendor[];
  /** Every offering across the compared vendors, grouped by how widely it's shared. */
  shared: CompareRow[]; // held by all
  partial: CompareRow[]; // held by some, not all (only when 3+ vendors)
  unique: CompareRow[][]; // per vendor: held by that vendor alone
  /** similarity[i][j]: rarity-weighted overlap, 0–100. */
  similarity: number[][];
  /**
   * Per vendor: offerings another compared vendor has, that this one lacks,
   * and that a meaningful share of this vendor's own peer group offers.
   * The "why are they doing better" list.
   */
  couldAdd: { key: string; share: number; who: number[] }[][];
};

export async function compareVendors(ids: number[]): Promise<Comparison | null> {
  const unique = [...new Set(ids)].slice(0, COMPARE_MAX);
  if (unique.length < 2) return null;

  const base = await query<Omit<CompareVendor, "peers" | "rare">>(
    `select v.id::int, v.name, v.emirate, v.sectors, v.activities, v.email, v.phone, v.address, v.associates
       from public.vendors v where v.id = any($1::int[])`,
    [unique],
  );
  if (base.length < 2) return null;
  // Keep the order the ids were given in: it's the order of the columns.
  const ordered = unique.map((id) => base.find((v) => v.id === id)).filter((v): v is NonNullable<typeof v> => Boolean(v));

  const all = [...new Set(ordered.flatMap((v) => v.activities))];
  const [freq, peers, directory] = await Promise.all([
    query<{ key: string; n: number }>(
      `select a as key, count(*)::int n from public.vendors, unnest(activities) a where a = any($1::text[]) group by a`,
      [all],
    ),
    Promise.all(ordered.map((v) => peerSector(v.sectors, v.activities))),
    queryOne<{ n: number }>(`select count(*)::int n from public.vendors`),
  ]);
  const N = directory!.n;
  const count = new Map(freq.map((f) => [f.key, f.n]));
  const weight = (a: string) => Math.log(N / Math.max(1, count.get(a) ?? 1));

  const vendors: CompareVendor[] = ordered.map((v, i) => ({
    ...v,
    peers: peers[i],
    rare: v.activities.filter((a) => (count.get(a) ?? 1) <= Math.max(2, N * RARE_SHARE)).length,
  }));

  const rows: CompareRow[] = all
    .map((key) => ({ key, n: count.get(key) ?? 1, has: vendors.map((v) => v.activities.includes(key)) }))
    .sort((a, b) => a.n - b.n || a.key.localeCompare(b.key)); // rarest first

  const held = (r: CompareRow) => r.has.filter(Boolean).length;
  const shared = rows.filter((r) => held(r) === vendors.length);
  const partial = rows.filter((r) => held(r) > 1 && held(r) < vendors.length);
  const uniqueRows = vendors.map((_, i) => rows.filter((r) => held(r) === 1 && r.has[i]));

  const similarity = vendors.map((a) =>
    vendors.map((b) => {
      if (a === b) return 100;
      const union = new Set([...a.activities, ...b.activities]);
      const inter = a.activities.filter((x) => b.activities.includes(x));
      const u = [...union].reduce((s, x) => s + weight(x), 0);
      return u === 0 ? 0 : Math.round((inter.reduce((s, x) => s + weight(x), 0) / u) * 100);
    }),
  );

  // Peer share of each candidate gap, per (sector, activity).
  const pairs = vendors.flatMap((v, i) =>
    v.peers ? rows.filter((r) => !r.has[i] && held(r) >= 1).map((r) => [v.peers!.sector, r.key] as const) : [],
  );
  const share = new Map<string, number>();
  if (pairs.length) {
    const sectors = [...new Set(pairs.map((p) => p[0]))];
    const acts = [...new Set(pairs.map((p) => p[1]))];
    const found = await query<{ s: string; a: string; share: number }>(
      `with sz as (select s, count(*)::float n from public.vendors, unnest(sectors) s where s = any($1::text[]) group by s)
       select vs.s, va.a, round(count(*) / sz.n * 100)::int as share
         from public.vendors v
         cross join unnest(v.sectors) vs(s)
         cross join unnest(v.activities) va(a)
         join sz on sz.s = vs.s
        where vs.s = any($1::text[]) and va.a = any($2::text[])
        group by vs.s, va.a, sz.n`,
      [sectors, acts],
    );
    for (const f of found) share.set(`${f.s}\u0000${f.a}`, f.share);
  }
  const couldAdd = vendors.map((v, i) =>
    v.peers
      ? rows
          .filter((r) => !r.has[i])
          .map((r) => ({
            key: r.key,
            share: share.get(`${v.peers!.sector}\u0000${r.key}`) ?? 0,
            who: r.has.flatMap((h, j) => (h ? [j] : [])),
          }))
          .filter((g) => g.share >= 10)
          .sort((a, b) => b.share - a.share)
          .slice(0, 6)
      : [],
  );

  return { vendors, shared, partial, unique: uniqueRows, similarity, couldAdd };
}
