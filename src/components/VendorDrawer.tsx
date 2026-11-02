"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { VendorDetail } from "@/lib/search";
import { SECTOR_BY_ID } from "@/lib/sectors";
import { emailList, phoneInfo } from "@/lib/normalize";
import { CompareButton } from "./CompareTray";
import { ChatIcon, CopyIcon, MailIcon, NoteIcon, PenIcon, PhoneIcon, PinIcon, TrashIcon, XIcon } from "./icons";
import { toast } from "./Toaster";
import { VendorForm, type VendorFormValues } from "./VendorForm";

const SOURCE_NOTE: Record<string, string> = {
  address: "Read from the address",
  name: "Read from the branch in the company name",
  phone: "Worked out from the phone area code",
  manual: "Set by hand",
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dubai" });

const EMPTY: VendorFormValues = { name: "", email: "", phone: "", address: "", activities: "", emirate: "", notes: "" };

// A vendor registered in many sectors shows the first few; the rest on request.
const SECTORS_SHOWN = 4;

type Loaded = { id: number; vendor: VendorDetail | null; error: string | null };

async function fetchVendor(id: number): Promise<Loaded> {
  try {
    const res = await fetch(`/api/vendors/${id}`);
    const data = await res.json();
    return res.ok ? { id, vendor: data, error: null } : { id, vendor: null, error: data.error ?? "Couldn't load this vendor." };
  } catch {
    return { id, vendor: null, error: "Couldn't reach the server. Check your connection." };
  }
}

async function send(url: string, method: string, body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

function copy(text: string, what: string) {
  navigator.clipboard.writeText(text).then(
    () => toast(`${what} copied`),
    () => toast("Copy isn't available in this browser.", "error"),
  );
}

/** One company, opened from anywhere via ?v=<id> (or ?v=new to add one). */
export function VendorDrawer({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const v = params.get("v");
  const panelRef = useRef<HTMLDivElement>(null);

  const isNew = v === "new" && isAdmin;
  const id = v && /^\d+$/.test(v) ? Number(v) : null;
  const open = isNew || id != null;

  // Results are keyed by id, so a stale one never shows for another vendor.
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [focusNotes, setFocusNotes] = useState(false);
  const [sectorsOpen, setSectorsOpen] = useState<number | null>(null); // vendor whose sectors are all shown
  const vendor = loaded && loaded.id === id ? loaded.vendor : null;
  const error = loaded && loaded.id === id ? loaded.error : null;
  const editing = id != null && editingId === id;
  const setEditing = (on: boolean, notes = false) => {
    setFocusNotes(on && notes);
    setEditingId(on ? id : null);
  };

  const close = useCallback(() => {
    const p = new URLSearchParams(window.location.search);
    p.delete("v");
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname]);

  useEffect(() => {
    if (id == null) return;
    let current = true;
    fetchVendor(id).then((r) => current && setLoaded(r));
    return () => {
      current = false;
    };
  }, [id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !editing && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, editing, close]);

  // Only on opening: refocusing on every edit toggle would steal focus from
  // the form's first field (or the notes box, from "Add a note").
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const remove = async () => {
    if (!vendor || !confirm(`Delete ${vendor.name}? This can't be undone.`)) return;
    const { ok, data } = await send(`/api/vendors/${vendor.id}`, "DELETE");
    if (!ok) return toast(String(data.error), "error");
    toast(`Deleted ${vendor.name}`);
    close();
    router.refresh();
  };

  const phones = vendor ? phoneInfo(vendor.phone) : null;
  const emails = vendor ? emailList(vendor.email) : [];
  const mapsQuery = vendor
    ? [vendor.address, vendor.emirate, "United Arab Emirates"].filter(Boolean).join(", ")
    : "";

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={vendor?.name ?? "Vendor"}>
      <div className="scrim absolute inset-0 bg-[rgb(20_26_58/0.35)] backdrop-blur-[2px]" onClick={() => !editing && close()} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="sheet scroll-quiet absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-2xl bg-panel text-ink shadow-[var(--shadow-pop)] outline-none md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[560px] md:rounded-none md:rounded-l-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center gap-1 border-b border-line bg-panel/95 px-4 py-3 backdrop-blur md:px-6">
          <span className="mx-auto h-1 w-10 rounded-full bg-line-strong md:hidden" aria-hidden="true" />
          <div className="absolute right-3 top-2 flex gap-1 md:static md:ml-auto md:mr-0">
            {isAdmin && vendor && !editing && (
              <>
                <button type="button" onClick={() => setEditing(true)} className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-panel-2 hover:text-ink">
                  <PenIcon size={16} /> Edit
                </button>
                <button type="button" onClick={remove} className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-danger-soft hover:text-danger">
                  <TrashIcon size={16} /> Delete
                </button>
              </>
            )}
            <button type="button" onClick={close} className="grid h-9 w-9 place-items-center rounded-lg text-ink-2 hover:bg-panel-2 hover:text-ink">
              <XIcon />
              <span className="sr-only">Close</span>
            </button>
          </div>
        </div>

        <div className="px-5 pb-10 pt-5 md:px-8 md:pt-7">
          {isNew && (
            <>
              <h2 className="title mb-6 text-[26px]">Add a vendor</h2>
              <VendorForm
                initial={EMPTY}
                submitLabel="Add vendor"
                onCancel={close}
                onSubmit={async (values) => {
                  const { ok, data } = await send("/api/vendors", "POST", values);
                  if (!ok) return String(data.error);
                  toast(`Added ${values.name}`);
                  const p = new URLSearchParams(window.location.search);
                  p.set("v", String(data.id));
                  router.replace(`${pathname}?${p}`, { scroll: false });
                  router.refresh();
                  return null;
                }}
              />
            </>
          )}

          {error && <p className="py-10 text-center text-[15px] text-ink-2">{error}</p>}
          {!isNew && !vendor && !error && <DrawerSkeleton />}

          {vendor && editing && (
            <>
              <h2 className="title mb-6 text-[26px]">Edit vendor</h2>
              <VendorForm
                initial={{
                  name: vendor.name,
                  email: vendor.email ?? "",
                  phone: vendor.phone ?? "",
                  address: vendor.address ?? "",
                  activities: vendor.activities.join("\n"),
                  emirate: vendor.emirate_source === "manual" ? (vendor.emirate ?? "") : "",
                  notes: vendor.notes ?? "",
                }}
                focusNotes={focusNotes}
                submitLabel="Save changes"
                onCancel={() => setEditing(false)}
                onSubmit={async (values) => {
                  const { ok, data } = await send(`/api/vendors/${vendor.id}`, "PATCH", values);
                  if (!ok) return String(data.error);
                  toast("Changes saved");
                  setEditing(false);
                  setLoaded(await fetchVendor(vendor.id));
                  router.refresh();
                  return null;
                }}
              />
            </>
          )}

          {vendor && !editing && (
            <article>
              <h2 className="title text-[30px] leading-tight md:text-[34px]">
                {vendor.name}
                {vendor.name_cut && <span className="text-ink-3">…</span>}
              </h2>
              {vendor.name_cut && (
                <p className="mt-1 text-[12px] text-ink-3">
                  Shortened in the list it came from.{isAdmin && " Edit to add the full name, or upload a file that has it."}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {(sectorsOpen === vendor.id ? vendor.sectors : vendor.sectors.slice(0, SECTORS_SHOWN)).map((s) => (
                  <Link
                    key={s}
                    href={`/?sector=${s}`}
                    className="inline-block rounded-full border border-line-strong px-2.5 py-1 text-[12px] font-medium text-ink-2 transition hover:border-ink hover:text-ink"
                  >
                    {SECTOR_BY_ID.get(s)?.name ?? s}
                  </Link>
                ))}
                {vendor.sectors.length > SECTORS_SHOWN && sectorsOpen !== vendor.id && (
                  <button
                    type="button"
                    onClick={() => setSectorsOpen(vendor.id)}
                    className="rounded-full px-2.5 py-1 text-[12px] font-semibold text-accent-text hover:bg-accent-soft"
                  >
                    {vendor.sectors.length - SECTORS_SHOWN} more
                  </button>
                )}
                <CompareButton id={vendor.id} name={vendor.name} size="sm" className="ml-auto" />
              </div>

              <Notes notes={vendor.notes} isAdmin={isAdmin} onAdd={() => setEditing(true, true)} />

              <Position vendor={vendor} />

              {/* Contact */}
              <section className="mt-7 space-y-2">
                <h3 className="text-[13px] font-medium text-ink-3">Contact</h3>
                {phones ? (
                  <div className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
                    <PhoneIcon className="shrink-0 text-ink-3" />
                    <a href={`tel:${phones.dial}`} className="pii num min-w-0 flex-1 truncate text-[16px] font-medium hover:text-accent-text">
                      {phones.display}
                    </a>
                    <div className="pii-hide flex gap-1">
                      {phones.mobile && (
                        <a href={`https://wa.me/${phones.dial.slice(1)}`} target="_blank" rel="noopener noreferrer" className="grid h-9 w-9 place-items-center rounded-lg text-ink-2 hover:bg-panel-2" title="WhatsApp">
                          <ChatIcon size={17} />
                          <span className="sr-only">WhatsApp</span>
                        </a>
                      )}
                      <button type="button" onClick={() => copy(phones.display, "Number")} className="grid h-9 w-9 place-items-center rounded-lg text-ink-2 hover:bg-panel-2" title="Copy number">
                        <CopyIcon size={17} />
                        <span className="sr-only">Copy number</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  vendor.phone && <p className="pii rounded-xl border border-line px-4 py-3 text-[15px]">{vendor.phone}</p>
                )}
                {phones && vendor.phone && vendor.phone.replace(/\D/g, "").length > 13 && (
                  <p className="pii px-1 text-[13px] text-ink-3">As recorded: {vendor.phone}</p>
                )}
                {emails.map((em) => (
                  <div key={em} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
                    <MailIcon className="shrink-0 text-ink-3" />
                    <a href={`mailto:${em}`} className="pii min-w-0 flex-1 truncate text-[15px] font-medium hover:text-accent-text">
                      {em}
                    </a>
                    <button type="button" onClick={() => copy(em, "Email")} className="pii-hide grid h-9 w-9 place-items-center rounded-lg text-ink-2 hover:bg-panel-2" title="Copy email">
                      <CopyIcon size={17} />
                      <span className="sr-only">Copy email</span>
                    </button>
                  </div>
                ))}
                {emails.length === 0 && vendor.email && <p className="pii rounded-xl border border-line px-4 py-3 text-[15px]">{vendor.email}</p>}
                {!vendor.phone && !vendor.email && <p className="text-[14px] text-ink-3">No contact details recorded.</p>}
              </section>

              {/* Location */}
              <section className="mt-7">
                <h3 className="text-[13px] font-medium text-ink-3">Location</h3>
                <div className="mt-2 flex items-start gap-3">
                  <PinIcon className="mt-0.5 shrink-0 text-ink-3" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-medium">{vendor.emirate ?? "Emirate not recorded"}</p>
                    {vendor.emirate_source && <p className="text-[12px] text-ink-3">{SOURCE_NOTE[vendor.emirate_source]}</p>}
                    {vendor.address && <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{vendor.address}</p>}
                  </div>
                  {vendor.address && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-accent-text hover:bg-accent-soft"
                    >
                      Open map
                    </a>
                  )}
                </div>
              </section>

              {/* Activities */}
              <section className="mt-8">
                <h3 className="text-[13px] font-medium text-ink-3">
                  What they do <span className="num">({vendor.activities.length})</span>
                </h3>
                <ul className="mt-2 divide-y divide-line border-y border-line">
                  {vendor.activities.map((a) => (
                    <li key={a}>
                      <Link
                        href={`/?activity=${encodeURIComponent(a)}`}
                        className="flex items-baseline justify-between gap-4 py-2.5 text-[14px] leading-snug text-ink hover:text-accent-text"
                      >
                        <span className="min-w-0">{a}</span>
                        {vendor.activity_codes[a] && <span className="num shrink-0 text-[12px] text-ink-3">{vendor.activity_codes[a]}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
                {vendor.activities.length === 0 && <p className="mt-2 text-[14px] text-ink-3">No area of business recorded.</p>}
              </section>

              {vendor.associates.length > 0 && (
                <section className="mt-8">
                  <h3 className="text-[13px] font-medium text-ink-3">
                    Associated companies <span className="num">({vendor.associates.length})</span>
                  </h3>
                  <ul className="mt-2 divide-y divide-line border-y border-line">
                    {vendor.associates.map((a) => (
                      <li key={a.name}>
                        <Link
                          href={`/?q=${encodeURIComponent(a.name.split(/\s+/).slice(0, 2).join(" "))}`}
                          className="flex items-baseline justify-between gap-4 py-2.5 text-[14px] leading-snug text-ink hover:text-accent-text"
                        >
                          <span className="min-w-0">{a.name}</span>
                          {a.country && <span className="shrink-0 text-[12px] text-ink-3">{a.country}</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[12px] text-ink-3">Open one to see every vendor associated with that company.</p>
                </section>
              )}


              <p className="mt-10 text-[12px] leading-relaxed text-ink-3">
                {vendor.sources.length > 0 && <>Listed in {vendor.sources.join(", ")}. </>}
                Added {fmtDate(vendor.created_at)}
                {vendor.updated_at.slice(0, 16) !== vendor.created_at.slice(0, 16) && <>, last changed {fmtDate(vendor.updated_at)}</>}
              </p>
            </article>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The team's own notes on this vendor. Hidden while contacts are hidden, since
 * they're written for the team, not for whoever is watching the screen.
 */
function Notes({ notes, isAdmin, onAdd }: { notes: string | null; isAdmin: boolean; onAdd: () => void }) {
  if (!notes && !isAdmin) return null;
  return (
    <section className="pii-hide mt-6">
      {notes ? (
        <div className="rounded-2xl border border-line bg-note px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
              <NoteIcon size={16} className="text-ink-3" /> Additional notes
            </h3>
            {isAdmin && (
              <button type="button" onClick={onAdd} className="rounded-full px-2.5 py-1 text-[12px] font-semibold text-accent-text hover:bg-accent-soft">
                Edit notes
              </button>
            )}
          </div>
          <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink">{notes}</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={onAdd}
          className="flex w-full items-center gap-2 rounded-2xl border border-dashed border-line-strong px-5 py-3 text-left text-[14px] font-medium text-ink-2 transition hover:border-accent hover:text-accent-text"
        >
          <NoteIcon size={17} /> Add a note about this vendor
        </button>
      )}
    </section>
  );
}

/**
 * Where this vendor stands among its peers: breadth, what few others offer,
 * what peers commonly offer that it doesn't, and who it most resembles.
 */
function Position({ vendor }: { vendor: VendorDetail }) {
  const router = useRouter();
  const pathname = usePathname();
  const p = vendor.position;
  if (!p.peers && p.competitors.length === 0) return null;

  const open = (id: number) => {
    const sp = new URLSearchParams(window.location.search);
    sp.set("v", String(id));
    router.push(`${pathname}?${sp}`, { scroll: false });
  };

  return (
    <section className="mt-7 rounded-2xl bg-panel-2 px-5 py-5">
      <h3 className="title text-[20px]">Position in the market</h3>

      {p.peers && (
        <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
          One of <span className="num font-medium text-ink">{p.peers.n.toLocaleString("en-US")}</span> vendors in{" "}
          <Link href={`/?sector=${p.peers.sector}`} className="font-medium text-accent-text hover:underline">
            {p.peers.name.toLowerCase()}
          </Link>
          {p.breadth && (
            <>
              . Lists <span className="num font-medium text-ink">{p.breadth.mine}</span> offerings against a group median of{" "}
              <span className="num">{p.breadth.median}</span>
              {p.breadth.percentile >= 99
                ? ": the broadest offering in the group."
                : p.breadth.percentile >= 50
                  ? `, broader than ${p.breadth.percentile}% of them.`
                  : p.breadth.percentile <= 25
                    ? ", narrower than most."
                    : "."}
            </>
          )}
        </p>
      )}

      {p.distinctive.length > 0 && (
        <div className="mt-4">
          <h4 className="text-[13px] font-medium text-ink-3">Few others offer</h4>
          <ul className="mt-1.5 space-y-1.5">
            {p.distinctive.map((d) => (
              <li key={d.key} className="flex items-baseline justify-between gap-3 text-[14px] leading-snug">
                <Link href={`/?activity=${encodeURIComponent(d.key)}`} className="min-w-0 text-ink hover:text-accent-text">
                  {d.key}
                </Link>
                <span className="num shrink-0 text-[12px] text-ink-3">{d.n === 1 ? "only this vendor" : `${d.n} vendors`}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {p.gaps.length > 0 && (
        <div className="mt-4">
          <h4 className="text-[13px] font-medium text-ink-3">Common among peers, not listed here</h4>
          <ul className="mt-1.5 space-y-1.5">
            {p.gaps.map((g) => (
              <li key={g.key} className="flex items-baseline justify-between gap-3 text-[14px] leading-snug">
                <Link href={`/?activity=${encodeURIComponent(g.key)}`} className="min-w-0 text-ink hover:text-accent-text">
                  {g.key}
                </Link>
                <span className="num shrink-0 text-[12px] text-ink-3">{g.share}% of peers</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {p.competitors.length > 0 && (
        <div className="mt-4">
          <h4 className="text-[13px] font-medium text-ink-3">Closest competitors</h4>
          <ul className="mt-1 divide-y divide-line">
            {p.competitors.map((c) => (
              <li key={c.id} className="flex items-center gap-2 py-2">
                <button type="button" onClick={() => open(c.id)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[14px] font-medium text-ink hover:text-accent-text">{c.name}</span>
                  <span className="num block text-[12px] text-ink-3">
                    {c.similarity}% overlap · {c.shared} shared {c.shared === 1 ? "offering" : "offerings"}
                  </span>
                </button>
                <CompareButton id={c.id} name={c.name} size="sm" />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-3">
            Overlap weighs rare offerings more than common ones.
          </p>
        </div>
      )}
    </section>
  );
}

function DrawerSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-label="Loading">
      <div className="h-8 w-3/4 rounded bg-panel-2" />
      <div className="h-5 w-1/2 rounded bg-panel-2" />
      <div className="h-14 rounded-xl bg-panel-2" />
      <div className="h-14 rounded-xl bg-panel-2" />
      <div className="h-24 rounded-xl bg-panel-2" />
    </div>
  );
}
