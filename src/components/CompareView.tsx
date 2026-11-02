import Link from "next/link";
import { fmt } from "@/lib/format";
import type { CompareRow, Comparison } from "@/lib/insights";
import { SECTOR_BY_ID } from "@/lib/sectors";
import { CompareActions } from "./CompareActions";
import { CheckIcon } from "./icons";

const WRAP = "mx-auto max-w-[1280px] px-4 md:px-8";
/** Rows shown before a matrix group folds. */
const FOLD = 12;
const SERIES = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)"];

/** A short handle for a vendor in dense places: first two words. */
const short = (name: string) =>
  name
    .replace(/\b(l\.?l\.?c\.?|llc|fzco?|fze|est\.?|establishment|co\.?|company|group|sole proprietorship|w\.?l\.?l\.?)\b/gi, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join(" ") || name;

function Dot({ i, size = 10 }: { i: number; size?: number }) {
  return <span className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: SERIES[i] }} aria-hidden="true" />;
}

function Matrix({ rows, names, n }: { rows: CompareRow[]; names: string[]; n: number }) {
  return (
    <table className="w-full border-collapse text-[14px]">
      <thead className="sr-only">
        <tr>
          <th>Offering</th>
          {names.map((name) => (
            <th key={name}>{name}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((r) => (
          <tr key={r.key}>
            <td className="py-2.5 pr-3 leading-snug">
              <Link href={`/?activity=${encodeURIComponent(r.key)}`} className="text-ink hover:text-accent-text">
                {r.key}
              </Link>
              <span className="num ml-2 whitespace-nowrap text-[12px] text-ink-3">
                {r.n === 1 ? "only here" : `${fmt(r.n)} in directory`}
              </span>
            </td>
            {r.has.map((h, i) => (
              <td key={i} className="w-12 py-2.5 text-center md:w-16">
                {h ? (
                  <span className="inline-grid h-6 w-6 place-items-center rounded-full text-white" style={{ background: SERIES[i] }}>
                    <CheckIcon size={13} />
                    <span className="sr-only">{names[i]} offers this</span>
                  </span>
                ) : (
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-line-strong" aria-label={`${names[i]} does not`} />
                )}
              </td>
            ))}
            {Array.from({ length: n - r.has.length }).map((_, i) => (
              <td key={`pad${i}`} />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Group({ title, note, rows, names, n }: { title: string; note?: string; rows: CompareRow[]; names: string[]; n: number }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="title text-[22px]">{title}</h3>
        <span className="num text-[13px] text-ink-3">{fmt(rows.length)}</span>
      </div>
      {note && <p className="mt-0.5 text-[13px] text-ink-3">{note}</p>}
      <div className="mt-2">
        <Matrix rows={rows.slice(0, FOLD)} names={names} n={n} />
        {rows.length > FOLD && (
          <details className="group/more">
            <summary className="mt-2 cursor-pointer list-none text-[13px] font-medium text-accent-text hover:underline group-open/more:hidden">
              Show {rows.length - FOLD} more
            </summary>
            <Matrix rows={rows.slice(FOLD)} names={names} n={n} />
          </details>
        )}
      </div>
    </div>
  );
}

export function CompareView({ c }: { c: Comparison }) {
  const { vendors } = c;
  const names = vendors.map((v) => v.name);
  const shorts = vendors.map((v) => short(v.name));
  const n = vendors.length;
  const two = n === 2;

  // Pairwise overlaps, listed once each, strongest first.
  const pairs: { a: number; b: number; s: number }[] = [];
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) pairs.push({ a, b, s: c.similarity[a][b] });
  pairs.sort((x, y) => y.s - x.s);

  const overlapWord = (s: number) => (s >= 60 ? "near-interchangeable" : s >= 35 ? "clear rivals" : s >= 15 ? "some overlap" : "largely distinct");

  return (
    <>
      <div className="wash">
        <div className={`${WRAP} pb-8 pt-8 md:pb-10 md:pt-14`}>
          <h1 className="headline text-[40px] sm:text-[56px] lg:text-[72px]">
            {two ? (
              <>
                {shorts[0]} <em>against</em> {shorts[1]}
              </>
            ) : (
              <>
                {fmt(n)} vendors, <em>side by side</em>
              </>
            )}
          </h1>
          <p className="mt-5 max-w-3xl text-[17px] leading-relaxed text-ink-2 md:text-[19px]">
            {two ? (
              <>
                Their offerings overlap by <span className="num font-semibold text-ink">{pairs[0].s}%</span>:{" "}
                {overlapWord(pairs[0].s)}. {c.shared.length} shared {c.shared.length === 1 ? "offering" : "offerings"},{" "}
                {c.unique[0].length} only {shorts[0]} has, {c.unique[1].length} only {shorts[1]} has.
              </>
            ) : (
              <>
                The closest pair is {shorts[pairs[0].a]} and {shorts[pairs[0].b]} at{" "}
                <span className="num font-semibold text-ink">{pairs[0].s}%</span> overlap; the furthest apart are{" "}
                {shorts[pairs[pairs.length - 1].a]} and {shorts[pairs[pairs.length - 1].b]} at{" "}
                <span className="num font-semibold text-ink">{pairs[pairs.length - 1].s}%</span>.
              </>
            )}
          </p>
          <CompareActions vendors={vendors.map((v) => ({ id: v.id, name: v.name }))} />
        </div>
      </div>

      <main className={`${WRAP} space-y-12 pb-28 pt-8 md:space-y-16 md:pt-10`}>
        {/* The vendors: stacked on a phone, as columns from tablet up */}
        <section className="space-y-5 md:hidden">
          {vendors.map((v, i) => (
            <div key={v.id} className="border-t-2 pt-3" style={{ borderColor: SERIES[i] }}>
              <Link href={`/compare?ids=${vendors.map((x) => x.id).join(",")}&v=${v.id}`} scroll={false} className="title block text-[22px] leading-tight text-ink">
                {v.name}
              </Link>
              <p className="mt-1 text-[13px] text-ink-3">
                {v.emirate ?? "Location not recorded"}
                {v.peers ? ` · ${v.peers.name}, ${fmt(v.peers.n)} peers` : ""}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <dd className="title num text-[28px] leading-none">{fmt(v.activities.length)}</dd>
                  <dt className="mt-1 text-[12px] text-ink-3">offerings listed</dt>
                </div>
                <div>
                  <dd className={`title num text-[28px] leading-none ${v.rare === 0 ? "text-ink-3" : ""}`}>{fmt(v.rare)}</dd>
                  <dt className="mt-1 text-[12px] text-ink-3">rare offerings</dt>
                </div>
              </dl>
              <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
                {v.sectors.length ? v.sectors.map((s) => SECTOR_BY_ID.get(s)?.name ?? s).join(", ") : "No sector"}
                {" · "}
                {[v.email && "email", v.phone && "phone"].filter(Boolean).join(" and ") || "no contact details"}
              </p>
              {v.associates.length > 0 && (
                <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
                  <span className="text-ink-3">Associated with </span>
                  {v.associates.map((a) => a.name).join(", ")}
                </p>
              )}
            </div>
          ))}
        </section>
        <section className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[640px] border-collapse text-[14px]">
            <thead>
              <tr className="align-top">
                <th scope="col" className="sr-only">
                  Measure
                </th>
                {vendors.map((v, i) => (
                  <th key={v.id} scope="col" className="w-1/4 pb-4 pr-6 text-left font-normal">
                    <span className="flex items-start gap-2">
                      <span className="mt-2">
                        <Dot i={i} />
                      </span>
                      <span className="min-w-0">
                        <Link href={`/compare?ids=${vendors.map((x) => x.id).join(",")}&v=${v.id}`} scroll={false} className="title block text-[21px] leading-tight text-ink hover:text-accent-text">
                          {v.name}
                        </Link>
                        <span className="mt-1 block text-[13px] text-ink-3">
                          {v.emirate ?? "Location not recorded"}
                          {v.peers ? ` · ${v.peers.name}` : ""}
                        </span>
                      </span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line border-y border-line">
              <Row label="Offerings listed">{vendors.map((v) => <Big key={v.id}>{fmt(v.activities.length)}</Big>)}</Row>
              <Row label="Rare offerings" note="Held by fewer than 1% of the directory">
                {vendors.map((v) => (
                  <Big key={v.id} muted={v.rare === 0}>
                    {fmt(v.rare)}
                  </Big>
                ))}
              </Row>
              <Row label="Sectors">
                {vendors.map((v) => (
                  <span key={v.id} className="block text-[13px] leading-relaxed text-ink-2">
                    {v.sectors.length ? v.sectors.map((s) => SECTOR_BY_ID.get(s)?.name ?? s).join(", ") : "—"}
                  </span>
                ))}
              </Row>
              <Row label="Peer group" note="The most specific sector each works in">
                {vendors.map((v) => (
                  <span key={v.id} className="block text-[13px] text-ink-2">
                    {v.peers ? `${v.peers.name}, ${fmt(v.peers.n)} vendors` : "—"}
                  </span>
                ))}
              </Row>
              {vendors.some((v) => v.associates.length > 0) && (
                <Row label="Associated companies">
                  {vendors.map((v) => (
                    <span key={v.id} className="block text-[13px] leading-relaxed text-ink-2">
                      {v.associates.length
                        ? v.associates.map((a) => (a.country ? `${a.name} (${a.country})` : a.name)).join(", ")
                        : "None listed"}
                    </span>
                  ))}
                </Row>
              )}
              <Row label="Reachable">
                {vendors.map((v) => (
                  <span key={v.id} className="block text-[13px] text-ink-2">
                    {[v.email && "email", v.phone && "phone"].filter(Boolean).join(" and ") || "no contact details"}
                  </span>
                ))}
              </Row>
            </tbody>
          </table>
        </section>

        {/* Overlap, when there are more than two */}
        {!two && (
          <section>
            <h2 className="title text-[26px] md:text-[30px]">How much they overlap</h2>
            <p className="mt-1 max-w-2xl text-[14px] text-ink-3">Share of combined offerings both vendors have, weighing rare offerings more than common ones.</p>
            <ul className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-2 sm:grid-cols-2">
              {pairs.map((p) => (
                <li key={`${p.a}${p.b}`} className="flex items-center gap-3 border-b border-line py-2.5">
                  <span className="flex items-center gap-1">
                    <Dot i={p.a} />
                    <Dot i={p.b} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px]">
                    {shorts[p.a]} and {shorts[p.b]}
                  </span>
                  <span className="bar-track block w-16 shrink-0 overflow-hidden rounded-r sm:w-24">
                    <span className="bar-fill block" style={{ width: `${Math.max(2, p.s)}%` }} />
                  </span>
                  <span className="num w-10 shrink-0 text-right text-[14px] text-ink">{p.s}%</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Where each goes further, and what each could add */}
        <section>
          <h2 className="title text-[26px] md:text-[30px]">Where each one leads, and what it could add</h2>
          <p className="mt-1 max-w-2xl text-[14px] text-ink-3">
            An offering counts as a gap when another vendor here has it and a fair share of this vendor&apos;s own peer group offers it too.
          </p>
          <div className={`mt-6 grid grid-cols-[minmax(0,1fr)] gap-8 ${n === 2 ? "md:grid-cols-2" : n === 3 ? "md:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-4"}`}>
            {vendors.map((v, i) => (
              <div key={v.id} className="min-w-0 border-t-2 pt-4" style={{ borderColor: SERIES[i] }}>
                <h3 className="title truncate text-[20px]">{v.name}</h3>

                <h4 className="mt-4 text-[13px] font-medium text-ink-3">
                  {c.unique[i].length === 0 ? "Nothing the others lack" : `Only ${shorts[i]} offers`}
                </h4>
                {c.unique[i].length > 0 && (
                  <ul className="mt-1.5 space-y-1.5">
                    {c.unique[i].slice(0, 6).map((r) => (
                      <li key={r.key} className="flex items-baseline justify-between gap-3 text-[14px] leading-snug">
                        <span className="min-w-0 text-ink">{r.key}</span>
                        <span className="num shrink-0 text-[12px] text-ink-3">{r.n === 1 ? "unique" : `${fmt(r.n)} in dir.`}</span>
                      </li>
                    ))}
                    {c.unique[i].length > 6 && <li className="text-[12px] text-ink-3">and {c.unique[i].length - 6} more below</li>}
                  </ul>
                )}

                <h4 className="mt-5 text-[13px] font-medium text-ink-3">
                  {c.couldAdd[i].length === 0 ? "No obvious gaps against these" : "Could add, to match"}
                </h4>
                {c.couldAdd[i].length > 0 && (
                  <ul className="mt-1.5 space-y-2">
                    {c.couldAdd[i].map((g) => (
                      <li key={g.key} className="text-[14px] leading-snug">
                        <span className="text-ink">{g.key}</span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-3">
                          <span className="flex gap-0.5">
                            {g.who.map((j) => (
                              <Dot key={j} i={j} size={8} />
                            ))}
                          </span>
                          <span className="num">{g.share}% of {v.peers?.name.toLowerCase()} peers offer it</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* The full matrix */}
        <section className="space-y-10">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="title text-[26px] md:text-[30px]">Every offering</h2>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
              {vendors.map((v, i) => (
                <li key={v.id} className="flex items-center gap-1.5">
                  <Dot i={i} /> {shorts[i]}
                </li>
              ))}
            </ul>
          </div>
          <Group title={two ? "Both offer" : "All of them offer"} rows={c.shared} names={names} n={n} />
          {!two && <Group title="Some of them offer" rows={c.partial} names={names} n={n} />}
          {vendors.map((v, i) => (
            <Group key={v.id} title={`Only ${shorts[i]} offers`} rows={c.unique[i]} names={names} n={n} />
          ))}
        </section>
      </main>
    </>
  );
}

function Row({ label, note, children }: { label: string; note?: string; children: React.ReactNode[] }) {
  return (
    <tr className="align-top">
      <th scope="row" className="w-40 py-4 pr-4 text-left align-top text-[13px] font-medium text-ink-3">
        {label}
        {note && <span className="mt-0.5 block font-normal">{note}</span>}
      </th>
      {children.map((child, i) => (
        <td key={i} className="py-4 pr-6">
          {child}
        </td>
      ))}
    </tr>
  );
}

function Big({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return <span className={`title num block text-[30px] leading-none ${muted ? "text-ink-3" : "text-ink"}`}>{children}</span>;
}
