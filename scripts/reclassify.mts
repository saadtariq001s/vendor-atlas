// Re-run activity parsing, sector rules and location inference over every
// vendor. Run after editing src/lib/sectors.ts or src/lib/normalize.ts.
//   npm run db:reclassify
import { endPool, query } from "../src/lib/db";
import { normalizeVendor } from "../src/lib/normalize";

type Row = {
  id: number; name: string; email: string | null; phone: string | null;
  address: string | null; activities_raw: string | null;
  emirate: string | null; emirate_source: string | null;
};

const rows = await query<Row>(
  `select id::int, name, email, phone, address, activities_raw, emirate, emirate_source from public.vendors`,
);
let changed = 0;
for (const r of rows) {
  const v = normalizeVendor({
    name: r.name, email: r.email, phone: r.phone, address: r.address,
    activities: r.activities_raw,
    // Keep locations someone set by hand.
    emirate: r.emirate_source === "manual" ? r.emirate : null,
  });
  if (!v) continue;
  const res = await query(
    `update public.vendors set activities = $2, sectors = $3, emirate = $4, emirate_source = $5
      where id = $1 and (activities, sectors, emirate, emirate_source) is distinct from ($2::text[], $3::text[], $4, $5)
      returning id`,
    [r.id, v.activities, v.sectors, v.emirate, v.emirate_source],
  );
  changed += res.length;
}
console.log(`Reclassified ${rows.length} vendors; ${changed} changed.`);
await endPool();
