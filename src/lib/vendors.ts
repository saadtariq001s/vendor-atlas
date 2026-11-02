import type { PoolClient } from "pg";
import { query, queryOne, transaction } from "@/lib/db";
import { mergeAssociates, normalizeVendor, searchExtra, type Associate, type NormalizedVendor, type VendorInput } from "@/lib/normalize";
import { classifySectors } from "@/lib/sectors";
import type { AppUser } from "@/lib/auth";

// ── audit ──────────────────────────────────────────────────────────────────

export async function audit(
  user: AppUser | null,
  action: "import" | "create" | "update" | "delete",
  summary: string,
  client?: PoolClient,
) {
  const sql = `insert into public.audit_log (user_email, action, summary) values ($1, $2, $3)`;
  const params = [user?.email ?? "system", action, summary];
  if (client) await client.query(sql, params);
  else await query(sql, params);
}

export type AuditEntry = {
  id: number;
  user_email: string;
  action: string;
  summary: string;
  created_at: string;
};

export function recentAudit(limit = 12): Promise<AuditEntry[]> {
  return query<AuditEntry>(
    `select id::int, user_email, action, summary, created_at
       from public.audit_log order by created_at desc limit $1`,
    [limit],
  );
}

// ── single vendor ──────────────────────────────────────────────────────────

export class VendorError extends Error {}

async function assertNameFree(nameKey: string, exceptId?: number) {
  const clash = await queryOne<{ id: number; name: string }>(
    `select id::int, name from public.vendors where name_key = $1 and ($2::bigint is null or id <> $2)`,
    [nameKey, exceptId ?? null],
  );
  if (clash) throw new VendorError(`"${clash.name}" is already in the directory.`);
}

export async function createVendor(input: VendorInput, user: AppUser): Promise<number> {
  const v = normalizeVendor(input);
  if (!v) throw new VendorError("Add a company name.");
  await assertNameFree(v.name_key);
  const row = await queryOne<{ id: number }>(
    `insert into public.vendors
       (name, name_key, email, phone, address, activities_raw, activities, sectors, emirate, emirate_source, notes)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     returning id::int`,
    [v.name, v.name_key, v.email, v.phone, v.address, v.activities_raw, v.activities, v.sectors, v.emirate, v.emirate_source, v.notes],
  );
  await audit(user, "create", `Added ${v.name}`);
  return row!.id;
}

export async function updateVendor(id: number, input: VendorInput, user: AppUser): Promise<void> {
  const v = normalizeVendor(input);
  if (!v) throw new VendorError("Add a company name.");
  await assertNameFree(v.name_key, id);
  const res = await query(
    `update public.vendors set
       name = $2, name_key = $3, email = $4, phone = $5, address = $6,
       activities_raw = $7, activities = $8, sectors = $9, emirate = $10, emirate_source = $11, notes = $12,
       name_cut = name_cut and name = $2 -- a name corrected by hand is no longer a cut one
     where id = $1 returning id`,
    [id, v.name, v.name_key, v.email, v.phone, v.address, v.activities_raw, v.activities, v.sectors, v.emirate, v.emirate_source, v.notes],
  );
  if (res.length === 0) throw new VendorError("That vendor no longer exists.");
  await audit(user, "update", `Edited ${v.name}`);
}

export async function deleteVendors(ids: number[], user: AppUser): Promise<number> {
  if (ids.length === 0) return 0;
  const rows = await query<{ name: string }>(
    `delete from public.vendors where id = any($1::bigint[]) returning name`,
    [ids],
  );
  if (rows.length > 0) {
    await audit(
      user,
      "delete",
      rows.length === 1 ? `Deleted ${rows[0].name}` : `Deleted ${rows.length} vendors`,
    );
  }
  return rows.length;
}

// ── import ─────────────────────────────────────────────────────────────────

export type ImportMode = "merge" | "replace";

export type ImportPlan = {
  vendors: NormalizedVendor[];
  inserts: number;
  updates: number;
  enriched: number; // listed vendors that gain offerings they didn't have
  mergedInFile: number; // rows folded into an earlier row with the same name
  skipped: number; // rows with no company name
  byShortName: number; // shortened names matched to a vendor's full name
  renamed: number; // listed vendors whose shortened name a file now completes
  stillShort: number; // shortened names with no match, added as written
  /** Listed vendors to rename (old key -> full name) before the upsert. */
  renames: { old_key: string; name_key: string; name: string }[];
};

const lower = (s: string) => s.toLowerCase();
const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];
/** A name key without spaces, for matching a cut name ("abudh") to a full one ("abu dhabi"). */
const compact = (key: string) => key.replace(/\s+/g, "");
/** Mixed case reads better than a list written in capitals. */
const betterName = (a: string, b: string) => (/[a-z]/.test(a) || !/[a-z]/.test(b) ? a : b);

/** Notes from two places, without repeating one already contained. */
function joinNotes(a: string | null, b: string | null): string | null {
  if (!a || !b) return a ?? b;
  if (a.includes(b)) return a;
  if (b.includes(a)) return b;
  return `${a}\n\n${b}`;
}

/** Offerings in `b` that `a` doesn't already list. */
function extraActivities(a: string[], b: string[]): string[] {
  const have = new Set(a.map(lower));
  return b.filter((x) => !have.has(lower(x)));
}

/**
 * Fold `r` into `prev` (the same company): the first non-empty contact
 * details win, and offerings, codes, associates, notes and sources combine.
 */
function absorb(prev: NormalizedVendor, r: NormalizedVendor) {
  prev.email ??= r.email;
  prev.phone ??= r.phone;
  prev.address ??= r.address;
  prev.notes = joinNotes(prev.notes, r.notes);
  if (!prev.emirate && r.emirate) {
    prev.emirate = r.emirate;
    prev.emirate_source = r.emirate_source;
  }
  const extra = extraActivities(prev.activities, r.activities);
  if (extra.length) {
    prev.activities = [...prev.activities, ...extra];
    // One per line from here on: exact, and read back the same way.
    prev.activities_raw = prev.activities.join("\n");
    prev.sectors = classifySectors(prev.name, prev.activities.join(" | "));
  }
  prev.activity_codes = { ...r.activity_codes, ...prev.activity_codes };
  prev.associates = mergeAssociates(prev.associates, r.associates);
  prev.sources = union(prev.sources, r.sources);
  if (!r.name_cut) {
    prev.name = prev.name_cut ? r.name : betterName(prev.name, r.name);
    prev.name_cut = false;
  }
  prev.search_extra = searchExtra(prev);
}

function foldDuplicates(rows: NormalizedVendor[]): { vendors: NormalizedVendor[]; merged: number } {
  const byKey = new Map<string, NormalizedVendor>();
  let merged = 0;
  for (const r of rows) {
    const prev = byKey.get(r.name_key);
    if (!prev) {
      byKey.set(r.name_key, { ...r });
      continue;
    }
    merged++;
    absorb(prev, r);
  }
  return { vendors: [...byKey.values()], merged };
}

/** Sorted compact keys, for finding every key that starts with a prefix. */
class PrefixIndex<T> {
  private items: { c: string; v: T }[];
  constructor(entries: [string, T][]) {
    this.items = entries.map(([k, v]) => ({ c: compact(k), v })).sort((a, b) => (a.c < b.c ? -1 : a.c > b.c ? 1 : 0));
  }
  startingWith(key: string): T[] {
    const p = compact(key);
    let lo = 0, hi = this.items.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.items[mid].c < p) lo = mid + 1;
      else hi = mid;
    }
    const out: T[] = [];
    for (let i = lo; i < this.items.length && this.items[i].c.startsWith(p); i++) out.push(this.items[i].v);
    return out;
  }
}

type Existing = {
  name_key: string;
  name: string;
  name_cut: boolean;
  activities_raw: string | null;
  activities: string[];
  notes: string | null;
  activity_codes: Record<string, string>;
  associates: Associate[];
  sources: string[];
};

/**
 * Work out what an import will do. In "merge" mode a company that is already
 * listed keeps every offering it has and gains any new ones from the file, so
 * importing a second or third spreadsheet adds to the directory rather than
 * overwriting what earlier files brought in.
 *
 * Lists that cut long names short are matched by the start of the name: a cut
 * name joins the one vendor (listed, or in another file) whose full name
 * begins with it, and a full name completes a vendor listed under a cut one.
 * Where more than one could match, nothing is guessed.
 */
export async function planImport(inputs: VendorInput[], mode: ImportMode): Promise<ImportPlan> {
  const normalized: NormalizedVendor[] = [];
  let skipped = 0;
  for (const input of inputs) {
    const v = normalizeVendor(input);
    if (v) normalized.push(v);
    else skipped++;
  }
  const first = foldDuplicates(normalized);
  let vendors = first.vendors;

  const listed =
    mode === "merge"
      ? await query<{ name_key: string; name: string; name_cut: boolean }>(`select name_key, name, name_cut from public.vendors`)
      : [];
  const listedKeys = new Set(listed.map((l) => l.name_key));

  // 1. Cut names in the files -> a full name, in the files or already listed.
  let byShortName = 0;
  let stillShort = 0;
  const fullInFiles = vendors.filter((v) => !v.name_cut);
  const index = new PrefixIndex<{ key: string; name: string; batch?: NormalizedVendor }>([
    ...fullInFiles.map((v): [string, { key: string; name: string; batch?: NormalizedVendor }] => [v.name_key, { key: v.name_key, name: v.name, batch: v }]),
    ...listed.filter((l) => !l.name_cut).map((l): [string, { key: string; name: string }] => [l.name_key, { key: l.name_key, name: l.name }]),
  ]);
  for (const v of vendors) {
    if (!v.name_cut || listedKeys.has(v.name_key) || compact(v.name_key).length < 12) continue;
    const hits = [...new Map(index.startingWith(v.name_key).filter((h) => h.key !== v.name_key).map((h) => [h.key, h])).values()];
    if (hits.length !== 1) {
      stillShort++;
      continue;
    }
    byShortName++;
    v.name_key = hits[0].key;
    v.name = hits[0].name;
    v.name_cut = false;
  }

  // 2. Full names in the files -> a vendor listed under a cut name.
  const renames: ImportPlan["renames"] = [];
  const cutListed = listed.filter((l) => l.name_cut);
  if (cutListed.length) {
    const fullIndex = new PrefixIndex(vendors.filter((v) => !v.name_cut && !listedKeys.has(v.name_key)).map((v): [string, NormalizedVendor] => [v.name_key, v]));
    for (const l of cutListed) {
      const hits = [...new Set(fullIndex.startingWith(l.name_key))];
      if (hits.length !== 1 || listedKeys.has(hits[0].name_key)) continue;
      renames.push({ old_key: l.name_key, name_key: hits[0].name_key, name: hits[0].name });
      listedKeys.delete(l.name_key);
      listedKeys.add(hits[0].name_key);
    }
  }

  // Matched names may now share a key: fold again.
  const second = foldDuplicates(vendors);
  vendors = second.vendors;

  let updates = 0;
  let enriched = 0;
  if (mode === "merge" && vendors.length) {
    const oldKeyFor = new Map(renames.map((r) => [r.name_key, r.old_key]));
    const keys = vendors.map((v) => oldKeyFor.get(v.name_key) ?? v.name_key);
    const existing = await query<Existing>(
      `select name_key, name, name_cut, activities_raw, activities, notes, activity_codes, associates, sources
         from public.vendors where name_key = any($1::text[])`,
      [keys],
    );
    const byKey = new Map(existing.map((e) => [e.name_key, e]));
    updates = existing.length;
    for (const v of vendors) {
      const old = byKey.get(oldKeyFor.get(v.name_key) ?? v.name_key);
      if (!old) continue;
      v.notes = v.notes && joinNotes(old.notes, v.notes);
      v.activity_codes = { ...v.activity_codes, ...old.activity_codes };
      v.associates = mergeAssociates(old.associates, v.associates);
      v.sources = union(old.sources, v.sources);
      if (!oldKeyFor.has(v.name_key) && !old.name_cut) v.name = v.name_cut ? old.name : betterName(v.name, old.name);
      v.search_extra = searchExtra(v);
      if (old.activities.length === 0) continue;
      const extra = extraActivities(old.activities, v.activities);
      if (extra.length) enriched++;
      v.activities = [...old.activities, ...extra];
      v.activities_raw = extra.length
        ? v.activities.join("\n")
        : (old.activities_raw ?? v.activities_raw);
      v.sectors = classifySectors(v.name, v.activities.join(" | "));
    }
  }
  return {
    vendors,
    inserts: vendors.length - updates,
    updates,
    enriched,
    mergedInFile: first.merged,
    skipped,
    byShortName,
    renamed: renames.length,
    stillShort,
    renames,
  };
}

const CHUNK = 1000;

/**
 * Apply an import in one transaction. "merge" adds new companies and updates
 * matching ones: a blank cell never erases what is already stored, offerings
 * and notes are added to (see planImport), and an emirate set by hand is
 * kept. "replace" empties the directory first.
 */
export async function applyImport(
  plan: ImportPlan,
  mode: ImportMode,
  user: AppUser | null, // null from the command-line seed script
  fileName: string,
): Promise<{ inserted: number; updated: number; removed: number }> {
  return transaction(async (client) => {
    let removed = 0;
    if (mode === "replace") {
      const res = await client.query(`delete from public.vendors`);
      removed = res.rowCount ?? 0;
    }
    // A full name completing a vendor listed under a shortened one.
    if (mode === "merge" && plan.renames.length) {
      await client.query(
        `update public.vendors v set name_key = x.name_key, name = x.name, name_cut = false
           from jsonb_to_recordset($1::jsonb) as x(old_key text, name_key text, name text)
          where v.name_key = x.old_key
            and not exists (select 1 from public.vendors o where o.name_key = x.name_key)`,
        [JSON.stringify(plan.renames)],
      );
    }
    let inserted = 0;
    let updated = 0;
    for (let i = 0; i < plan.vendors.length; i += CHUNK) {
      const chunk = plan.vendors.slice(i, i + CHUNK);
      const res = await client.query<{ inserted: boolean }>(
        `insert into public.vendors as t
           (name, name_key, email, phone, address, activities_raw, activities, sectors, emirate, emirate_source, notes,
            activity_codes, associates, sources, name_cut, search_extra)
         select name, name_key, email, phone, address, activities_raw, activities, sectors, emirate, emirate_source, notes,
                coalesce(activity_codes, '{}'), coalesce(associates, '[]'), coalesce(sources, '{}'), coalesce(name_cut, false), search_extra
           from jsonb_to_recordset($1::jsonb) as x(
             name text, name_key text, email text, phone text, address text,
             activities_raw text, activities text[], sectors text[], emirate text, emirate_source text, notes text,
             activity_codes jsonb, associates jsonb, sources text[], name_cut boolean, search_extra text)
         on conflict (name_key) do update set
           name           = excluded.name,
           name_cut       = t.name_cut and excluded.name_cut,
           activity_codes = excluded.activity_codes,
           associates     = excluded.associates,
           sources        = excluded.sources,
           search_extra   = excluded.search_extra,
           email          = coalesce(excluded.email, t.email),
           phone          = coalesce(excluded.phone, t.phone),
           address        = coalesce(excluded.address, t.address),
           activities_raw = coalesce(excluded.activities_raw, t.activities_raw),
           activities     = case when excluded.activities_raw is null then t.activities else excluded.activities end,
           sectors        = case when excluded.activities_raw is null then t.sectors else excluded.sectors end,
           emirate        = case when t.emirate_source = 'manual' then t.emirate else coalesce(excluded.emirate, t.emirate) end,
           emirate_source = case when t.emirate_source = 'manual' then t.emirate_source else coalesce(excluded.emirate_source, t.emirate_source) end,
           notes          = coalesce(excluded.notes, t.notes)
         returning (xmax = 0) as inserted`,
        [JSON.stringify(chunk)],
      );
      for (const r of res.rows) {
        if (r.inserted) inserted++;
        else updated++;
      }
    }
    const parts = [`${inserted.toLocaleString("en")} added`, `${updated.toLocaleString("en")} updated`];
    if (mode === "replace") parts.unshift(`replaced ${removed.toLocaleString("en")}`);
    await audit(user, "import", `Imported ${fileName}: ${parts.join(", ")}`, client);
    return { inserted, updated, removed };
  });
}
