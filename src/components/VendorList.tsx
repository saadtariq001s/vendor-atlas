"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SortKey, VendorRow } from "@/lib/search";
import { emailList, phoneInfo } from "@/lib/normalize";
import { highlight, matchesTerms } from "./highlight";
import { CompareButton } from "./CompareTray";
import { ChevronRightIcon, DownloadIcon, MailIcon, PhoneIcon, PlusIcon, TrashIcon } from "./icons";
import { toast } from "./Toaster";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "relevance", label: "Best match" },
  { key: "name", label: "Name A–Z" },
  { key: "capabilities", label: "Most capabilities" },
  { key: "recent", label: "Recently added" },
];

const fmt = (n: number) => n.toLocaleString("en-US");

/** Activities that match the search first, then the rest. */
function orderActivities(acts: string[], terms: string[]) {
  if (terms.length === 0) return acts;
  const hit = acts.filter((a) => matchesTerms(a, terms));
  return [...hit, ...acts.filter((a) => !hit.includes(a))];
}

export function VendorList({
  initialRows,
  total,
  params,
  sort,
  terms,
  pageSize,
  isAdmin,
  title = "Vendors",
}: {
  initialRows: VendorRow[];
  total: number;
  params: string; // current filters as a query string, without sort/offset
  sort: SortKey;
  terms: string[];
  pageSize: number;
  isAdmin: boolean;
  title?: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleting, startDelete] = useTransition();

  const withParams = (extra: Record<string, string>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return p.toString();
  };

  const open = (id: number | "new") => {
    const p = new URLSearchParams(window.location.search);
    p.set("v", String(id));
    router.push(`?${p}`, { scroll: false });
  };

  const loadMore = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/vendors?${withParams({ sort, offset: String(rows.length) })}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const { rows: more } = (await res.json()) as { rows: VendorRow[] };
      setRows((r) => [...r, ...more]);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't load more vendors.", "error");
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const deleteSelected = () => {
    const ids = [...selected];
    if (!confirm(`Delete ${fmt(ids.length)} ${ids.length === 1 ? "vendor" : "vendors"}? This can't be undone.`)) return;
    startDelete(async () => {
      const res = await fetch("/api/vendors/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const body = await res.json();
      if (!res.ok) return toast(body.error, "error");
      setRows((r) => r.filter((v) => !selected.has(v.id)));
      setSelected(new Set());
      setSelecting(false);
      toast(`Deleted ${fmt(body.deleted)} ${body.deleted === 1 ? "vendor" : "vendors"}`);
      router.refresh();
    });
  };

  const allShownSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  return (
    <section aria-labelledby="vendors-title" className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <h2 id="vendors-title" className="title mr-auto text-[26px] text-ink lg:text-[30px]">
          {title} <span className="num font-normal text-ink-3">{fmt(total)}</span>
        </h2>

        <label className="relative">
          <span className="sr-only">Sort by</span>
          <select
            value={sort}
            onChange={(e) => router.push(`?${withParams({ sort: e.target.value })}`, { scroll: false })}
            className="h-9 appearance-none rounded-lg border border-line-strong bg-panel pl-3 pr-8 text-[13px] font-medium text-ink"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </label>

        <a
          href={`/api/export?${withParams({ sort })}`}
          className="pii-hide flex h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-panel px-3 text-[13px] font-medium text-ink transition hover:border-accent hover:text-accent-text"
        >
          <DownloadIcon size={16} /> Export
        </a>

        {isAdmin && (
          <>
            <button
              type="button"
              onClick={() => {
                setSelecting((s) => !s);
                setSelected(new Set());
              }}
              aria-pressed={selecting}
              className="flex h-9 items-center rounded-lg border border-line-strong bg-panel px-3 text-[13px] font-medium text-ink transition hover:border-accent"
            >
              {selecting ? "Done" : "Select"}
            </button>
            <button
              type="button"
              onClick={() => open("new")}
              className="flex h-9 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[13px] font-semibold text-accent-ink transition hover:bg-accent-hover"
            >
              <PlusIcon size={16} /> Add vendor
            </button>
          </>
        )}
      </div>

      <div className="card mt-4 overflow-hidden">
        {/* Column heads, desktop only */}
        <div className="hidden grid-cols-[minmax(0,1fr)_210px_112px_24px] gap-6 border-b border-line bg-panel-2 px-5 py-2.5 text-[12px] font-medium text-ink-3 lg:grid">
          <span className="flex items-center gap-3">
            {selecting && (
              <input
                type="checkbox"
                aria-label="Select all shown"
                checked={allShownSelected}
                onChange={() => setSelected(allShownSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                className="h-4 w-4 accent-[var(--accent)]"
              />
            )}
            Company and activities
          </span>
          <span>Contact</span>
          <span />
          <span />
        </div>

        {rows.length === 0 && (
          <p className="px-5 py-10 text-center text-[14px] text-ink-3">No vendors match these filters.</p>
        )}

        <ul className="divide-y divide-line">
          {rows.map((v) => {
            const acts = orderActivities(v.activities, terms);
            const shown = acts.slice(0, 2);
            const extra = acts.length - shown.length;
            const phone = phoneInfo(v.phone);
            const email = emailList(v.email)[0] ?? null;
            return (
              <li
                key={v.id}
                onClick={() => (selecting ? toggle(v.id) : open(v.id))}
                className={`group grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2 px-4 py-4 transition-colors hover:bg-panel-2 lg:grid-cols-[minmax(0,1fr)_210px_112px_24px] lg:gap-6 lg:px-5 ${
                  selected.has(v.id) ? "bg-accent-soft hover:bg-accent-soft" : ""
                }`}
              >
                <div className="flex min-w-0 gap-3">
                  {selecting && (
                    <input
                      type="checkbox"
                      aria-label={`Select ${v.name}`}
                      checked={selected.has(v.id)}
                      onChange={() => toggle(v.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
                    />
                  )}
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (selecting) toggle(v.id);
                        else open(v.id);
                      }}
                      className="text-left text-[15px] font-semibold leading-snug text-ink group-hover:text-accent-text"
                    >
                      {highlight(v.name, terms)}
                    </button>
                    {shown.length > 0 && (
                      <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-2">
                        {shown.map((a, i) => (
                          <span key={a}>
                            {i > 0 && <span className="text-ink-3">, </span>}
                            {highlight(a, terms)}
                          </span>
                        ))}
                        {extra > 0 && <span className="whitespace-nowrap text-ink-3"> and {extra} more</span>}
                      </p>
                    )}
                    {v.emirate && <p className="mt-1 text-[12px] text-ink-3">{v.emirate}</p>}
                  </div>
                </div>

                <div className="hidden min-w-0 text-[14px] lg:block">
                  {email ? (
                    <a
                      href={`mailto:${email}`}
                      onClick={(e) => e.stopPropagation()}
                      className="pii block truncate text-ink hover:text-accent-text hover:underline"
                    >
                      {email}
                    </a>
                  ) : (
                    <p className="text-ink-3">No email</p>
                  )}
                  {phone ? (
                    <a
                      href={`tel:${phone.dial}`}
                      onClick={(e) => e.stopPropagation()}
                      className="pii num mt-0.5 block text-[13px] text-ink-2 hover:text-accent-text"
                    >
                      {phone.display}
                    </a>
                  ) : (
                    v.phone && <p className="pii mt-0.5 truncate text-[13px] text-ink-3">{v.phone}</p>
                  )}
                </div>

                <div className="hidden lg:block">
                  <CompareButton id={v.id} name={v.name} size="sm" />
                </div>

                {/* Phone: quick actions instead of the contact column */}
                <div className="flex gap-1 lg:hidden">
                  <CompareButton id={v.id} name={v.name} size="sm" />
                  {phone && (
                    <a
                      href={`tel:${phone.dial}`}
                      onClick={(e) => e.stopPropagation()}
                      className="pii-hide grid h-8 w-8 place-items-center rounded-full border border-line text-ink-2"
                    >
                      <PhoneIcon size={15} />
                      <span className="sr-only">Call {v.name}</span>
                    </a>
                  )}
                  {email && (
                    <a
                      href={`mailto:${email}`}
                      onClick={(e) => e.stopPropagation()}
                      className="pii-hide grid h-8 w-8 place-items-center rounded-full border border-line text-ink-2"
                    >
                      <MailIcon size={15} />
                      <span className="sr-only">Email {v.name}</span>
                    </a>
                  )}
                </div>

                <ChevronRightIcon className="mt-0.5 hidden text-ink-3 transition group-hover:translate-x-0.5 group-hover:text-accent-text lg:block" />
              </li>
            );
          })}
        </ul>

        {rows.length < total && (
          <div className="border-t border-line p-3 text-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={loading}
              className="h-10 rounded-lg px-4 text-[14px] font-medium text-accent-text transition hover:bg-accent-soft disabled:opacity-60"
            >
              {loading
                ? "Loading…"
                : total - rows.length <= pageSize
                  ? `Show the remaining ${fmt(total - rows.length)}`
                  : `Show ${fmt(pageSize)} more, ${fmt(total - rows.length)} left`}
            </button>
          </div>
        )}
      </div>

      {selecting && selected.size > 0 && (
        <div className="pop fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3 rounded-full bg-ink py-2 pl-5 pr-2 text-panel shadow-[var(--shadow-pop)]">
            <span className="text-[14px] font-medium">{fmt(selected.size)} selected</span>
            <button
              type="button"
              onClick={deleteSelected}
              disabled={deleting}
              className="flex h-9 items-center gap-1.5 rounded-full bg-danger px-4 text-[14px] font-semibold text-white disabled:opacity-60"
            >
              <TrashIcon size={16} /> {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
