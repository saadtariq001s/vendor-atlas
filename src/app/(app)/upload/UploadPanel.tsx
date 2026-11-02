"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { ImportFailure, ImportSource } from "@/lib/parse-sheet";
import { CheckIcon, FileIcon, UploadIcon } from "@/components/icons";
import { toast } from "@/components/Toaster";

const FIELDS = [
  ["name", "Company name"],
  ["activities", "What they offer"],
  ["code", "Offering code"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["address", "Address"],
  ["emirate", "Emirate"],
  ["associate", "Associated company"],
  ["associateCountry", "Associate's country"],
  ["notes", "Additional notes"],
] as const;
type Field = (typeof FIELDS)[number][0];
type ColumnMap = Partial<Record<Field, number>>;
type Mode = "merge" | "replace";
type Layout = ImportSource["layout"];

type Plan = {
  companies: number;
  inserts: number;
  updates: number;
  enriched: number;
  mergedInFile: number;
  inSeveral: number;
  skipped: number;
  withNotes: number;
  withAssociates: number;
  withCodes: number;
  byShortName: number;
  renamed: number;
  stillShort: number;
  sample: { name: string; emirate: string | null; sectors: string[]; activities: number }[];
};
type Preview = { sources: ImportSource[]; failed: ImportFailure[]; plan: Plan | null };
type Chosen = { key: string; file: File };
type Settings = { chosen: Chosen[]; maps: Record<string, ColumnMap>; layouts: Record<string, Layout>; skip: string[]; mode: Mode };

const fmt = (n: number) => n.toLocaleString("en-US");
const plural = (n: number, one: string, many = `${one}s`) => `${fmt(n)} ${n === 1 ? one : many}`;
const ACCEPT =
  ".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv";
const SPREADSHEET = /\.(xlsx|xls|csv)$/i;

export function UploadPanel({ directoryTotal }: { directoryTotal: number }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const nextKey = useRef(1);
  const latest = useRef(0);

  const [settings, setSettings] = useState<Settings>({ chosen: [], maps: {}, layouts: {}, skip: [], mode: "merge" });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [openSource, setOpenSource] = useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [busy, setBusy] = useState<"reading" | "importing" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const body = (s: Settings, commit = false) => {
    const form = new FormData();
    for (const c of s.chosen) {
      form.append("file", c.file);
      form.append("key", c.key);
    }
    form.set("mode", s.mode);
    form.set("maps", JSON.stringify(s.maps));
    form.set("skip", JSON.stringify(s.skip));
    form.set("layouts", JSON.stringify(s.layouts));
    if (commit) form.set("commit", "1");
    return form;
  };

  const post = async (s: Settings, commit = false) => {
    let res: Response;
    try {
      res = await fetch("/api/import", { method: "POST", body: body(s, commit) });
    } catch {
      throw new Error("Couldn't reach the server. Check the connection and try again.");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "The import failed.");
    return data;
  };

  /** Apply new settings and read the files again. Only the newest answer is shown. */
  const update = async (next: Settings) => {
    setSettings(next);
    setConfirmReplace(false);
    setError(null);
    if (next.chosen.length === 0) {
      setPreview(null);
      return;
    }
    const ticket = ++latest.current;
    setBusy("reading");
    try {
      const data = (await post(next)) as Preview;
      if (ticket === latest.current) setPreview(data);
    } catch (e) {
      if (ticket === latest.current) setError(e instanceof Error ? e.message : "Those files couldn't be read.");
    } finally {
      if (ticket === latest.current) setBusy(null);
    }
  };

  const add = (list: FileList | null | undefined) => {
    const incoming = [...(list ?? [])];
    if (inputRef.current) inputRef.current.value = "";
    if (incoming.length === 0) return;
    const wrong = incoming.filter((f) => !SPREADSHEET.test(f.name));
    if (wrong.length) toast(`${wrong.map((f) => f.name).join(", ")} isn't a spreadsheet and was left out.`, "error");
    const same = (a: File, b: File) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
    const fresh = incoming
      .filter((f) => SPREADSHEET.test(f.name))
      .filter((f) => !settings.chosen.some((c) => same(c.file, f)))
      .map((file) => ({ key: `f${nextKey.current++}`, file }));
    if (fresh.length === 0) return;
    update({ ...settings, chosen: [...settings.chosen, ...fresh] });
  };

  const removeFile = (key: string) => {
    const keep = (id: string) => !id.startsWith(`${key}/`);
    update({
      ...settings,
      chosen: settings.chosen.filter((c) => c.key !== key),
      maps: Object.fromEntries(Object.entries(settings.maps).filter(([id]) => keep(id))),
      layouts: Object.fromEntries(Object.entries(settings.layouts).filter(([id]) => keep(id))),
      skip: settings.skip.filter(keep),
    });
  };

  const setColumn = (source: ImportSource, field: Field, value: string) => {
    const map: ColumnMap = { ...source.map };
    if (value === "") delete map[field];
    else map[field] = Number(value);
    setOpenSource(source.id); // stay open while the person works through the columns
    update({ ...settings, maps: { ...settings.maps, [source.id]: map } });
  };

  const setLayout = (id: string, layout: Layout) => update({ ...settings, layouts: { ...settings.layouts, [id]: layout } });

  const toggleLeaveOut = (id: string) =>
    update({
      ...settings,
      skip: settings.skip.includes(id) ? settings.skip.filter((s) => s !== id) : [...settings.skip, id],
    });

  const reset = () => {
    latest.current++;
    setSettings({ chosen: [], maps: {}, layouts: {}, skip: [], mode: "merge" });
    setPreview(null);
    setError(null);
    setBusy(null);
    setOpenSource(null);
    setConfirmReplace(false);
  };

  const commit = async () => {
    if (!preview?.plan) return;
    setBusy("importing");
    setError(null);
    try {
      const r = await post(settings, true);
      toast(`Imported: ${fmt(r.inserted)} added, ${fmt(r.updated)} updated`);
      reset();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The import failed.");
      setBusy(null);
    }
  };

  const dropProps = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      add(e.dataTransfer.files);
    },
  };

  const picker = (
    <input ref={inputRef} type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => add(e.target.files)} />
  );

  if (settings.chosen.length === 0) {
    return (
      <div>
        <label
          {...dropProps}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition ${
            dragging ? "border-accent bg-accent-soft" : "border-line-strong bg-panel hover:border-accent hover:bg-panel-2"
          }`}
        >
          <UploadIcon size={30} className="text-accent-text" />
          <span className="mt-3 text-[17px] font-semibold text-ink">Drop spreadsheets here, or choose files</span>
          <span className="mt-1 max-w-md text-[14px] text-ink-3">
            Excel (.xlsx, .xls) or CSV. Pick as many as you like, up to 25 MB each. You&apos;ll see what will change before anything is saved.
          </span>
          {picker}
        </label>
        {error && <p role="alert" className="mt-3 text-[14px] text-danger">{error}</p>}
      </div>
    );
  }

  const plan = preview?.plan ?? null;
  const sourcesFor = (key: string) => preview?.sources.filter((s) => s.fileKey === key) ?? [];
  const failure = (key: string) => preview?.failed.find((f) => f.fileKey === key);
  const activeFiles = settings.chosen.filter((c) => sourcesFor(c.key).some((s) => !s.left)).length;
  const needsColumns = preview?.sources.some((s) => !s.left && s.needsMapping) ?? false;
  const allLeftOut = preview != null && preview.sources.length > 0 && preview.sources.every((s) => s.left);

  return (
    <div className="space-y-7" {...dropProps}>
      {/* Files */}
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-semibold">{plural(settings.chosen.length, "file")} chosen</h2>
          <div className="flex gap-1">
            <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-line-strong px-3.5 text-[13px] font-semibold transition hover:border-accent hover:text-accent-text">
              <UploadIcon size={15} /> Add more files
              {picker}
            </label>
            <button type="button" onClick={reset} className="h-9 rounded-full px-3 text-[13px] font-medium text-ink-2 hover:bg-panel-2 hover:text-ink">
              Clear all
            </button>
          </div>
        </div>

        <ul className={`mt-3 divide-y divide-line overflow-hidden rounded-2xl border transition ${dragging ? "border-accent" : "border-line"} bg-panel`}>
          {settings.chosen.map(({ key, file }) => {
            const sheets = sourcesFor(key);
            const failed = failure(key);
            return (
              <li key={key} className="px-4 py-3.5 md:px-5">
                <div className="flex items-center gap-3">
                  <FileIcon size={20} className={`shrink-0 ${failed ? "text-danger" : "text-ink-3"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">{file.name}</p>
                    {failed ? (
                      <p className="text-[13px] text-danger">This file {failed.error}</p>
                    ) : sheets.length === 0 ? (
                      <p className="text-[13px] text-ink-3">{busy === "reading" ? "Reading…" : " "}</p>
                    ) : sheets.length > 1 ? (
                      <p className="text-[13px] text-ink-3">{plural(sheets.length, "sheet")} with vendors</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(key)}
                    className="shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium text-ink-2 hover:bg-danger-soft hover:text-danger"
                  >
                    Remove
                  </button>
                </div>

                {sheets.length > 0 && (
                  <ul className="mt-2 space-y-2 pl-8">
                    {sheets.map((s) => (
                      <SheetRow
                        key={s.id}
                        source={s}
                        canLeaveOut={sheets.length > 1}
                        open={openSource === s.id || s.needsMapping}
                        onToggleOpen={() => setOpenSource(openSource === s.id ? null : s.id)}
                        onLeaveOut={() => toggleLeaveOut(s.id)}
                        onColumn={(field, value) => setColumn(s, field, value)}
                        onLayout={(layout) => setLayout(s.id, layout)}
                      />
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {error && (
        <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-[14px] text-danger">
          {error}
        </p>
      )}
      {needsColumns && (
        <p className="rounded-xl bg-danger-soft px-4 py-3 text-[14px] text-danger">
          Pick the column that holds the company name in each highlighted sheet to continue.
        </p>
      )}
      {allLeftOut && <p className="rounded-xl bg-panel-2 px-4 py-3 text-[14px] text-ink-2">Every sheet is left out. Include at least one to import.</p>}

      {plan && (
        <>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-[15px] font-semibold">How to import</legend>
            {(
              [
                [
                  "merge",
                  "Add new vendors and update the ones already listed",
                  "Matched by company name. Blank cells never erase what's stored, and offerings are added to, never removed.",
                ],
                ["replace", "Replace the whole directory with these files", `Removes all ${fmt(directoryTotal)} current vendors first, notes included.`],
              ] as const
            ).map(([value, label, hint]) => (
              <label
                key={value}
                className={`flex cursor-pointer gap-3 rounded-xl border px-4 py-3 transition ${
                  settings.mode === value
                    ? value === "replace"
                      ? "border-danger bg-danger-soft"
                      : "border-accent bg-accent-soft"
                    : "border-line bg-panel hover:bg-panel-2"
                }`}
              >
                <input
                  type="radio"
                  name="mode"
                  checked={settings.mode === value}
                  onChange={() => update({ ...settings, mode: value })}
                  className="mt-1 accent-[var(--accent)]"
                />
                <span>
                  <span className="block text-[14px] font-medium">{label}</span>
                  <span className="block text-[13px] text-ink-3">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="rounded-2xl bg-panel-2 px-5 py-5 text-[14px] leading-relaxed">
            <p className="title text-[22px]">
              {plural(plan.companies, "company", "companies")}
              {activeFiles > 1 && <span className="text-ink-2"> across {fmt(activeFiles)} files</span>}
            </p>
            <ul className="mt-2 space-y-0.5 text-ink-2">
              {settings.mode === "replace" && <li>{plural(directoryTotal, "current vendor")} will be removed</li>}
              {plan.inserts > 0 && <li>{fmt(plan.inserts)} will be added as new vendors</li>}
              {settings.mode === "merge" && plan.updates > 0 && (
                <li>
                  {fmt(plan.updates)} {plan.updates === 1 ? "is" : "are"} already listed and will be updated
                  {plan.enriched > 0 &&
                    (plan.updates === 1
                      ? ", gaining offerings it didn't have"
                      : `, and ${fmt(plan.enriched)} of them ${plan.enriched === 1 ? "gains" : "gain"} offerings not yet listed`)}
                </li>
              )}
              {plan.inSeveral > 0 && (
                <li>
                  {plural(plan.inSeveral, "company", "companies")} {plan.inSeveral === 1 ? "appears" : "appear"} in more than one file or sheet
                  and will be combined
                </li>
              )}
              {plan.mergedInFile > 0 && (
                <li>
                  {plan.mergedInFile === 1
                    ? "1 repeated row will be folded into the company it repeats"
                    : `${fmt(plan.mergedInFile)} repeated rows will be folded into the companies they repeat`}
                </li>
              )}
              {plan.byShortName > 0 && (
                <li>
                  {plural(plan.byShortName, "shortened name was", "shortened names were")} matched to a vendor&apos;s full name
                </li>
              )}
              {plan.renamed > 0 && <li>{plural(plan.renamed, "vendor listed under a shortened name gets", "vendors listed under a shortened name get")} the full name</li>}
              {plan.stillShort > 0 && (
                <li>
                  {plural(plan.stillShort, "shortened name has", "shortened names have")} no clear match and {plan.stillShort === 1 ? "is" : "are"} added as written
                </li>
              )}
              {plan.withCodes > 0 && <li>{fmt(plan.withCodes)} {plan.withCodes === 1 ? "comes" : "come"} with offering codes</li>}
              {plan.withAssociates > 0 && <li>{fmt(plan.withAssociates)} {plan.withAssociates === 1 ? "lists" : "list"} associated companies</li>}
              {plan.withNotes > 0 && <li>{fmt(plan.withNotes)} {plan.withNotes === 1 ? "comes" : "come"} with additional notes</li>}
              {plan.skipped > 0 && <li>{plural(plan.skipped, "row")} without a company name will be skipped</li>}
            </ul>
          </div>

          {plan.sample.length > 0 && (
            <div>
              <p className="text-[14px] font-semibold">First rows, as they&apos;ll appear</p>
              <div className="mt-2 overflow-x-auto rounded-xl border border-line bg-panel">
                <table className="w-full min-w-[560px] text-left text-[13px]">
                  <thead className="bg-panel-2 text-ink-3">
                    <tr>
                      <th className="px-3 py-2 font-medium">Company</th>
                      <th className="px-3 py-2 font-medium">Emirate</th>
                      <th className="px-3 py-2 font-medium">Sectors</th>
                      <th className="px-3 py-2 text-right font-medium">Offerings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {plan.sample.map((r) => (
                      <tr key={r.name}>
                        <td className="px-3 py-2 font-medium">{r.name}</td>
                        <td className="px-3 py-2 text-ink-2">{r.emirate ?? "Not found"}</td>
                        <td className="px-3 py-2 text-ink-2">
                          {r.sectors.slice(0, 3).join(", ") || "None"}
                          {r.sectors.length > 3 && ` and ${r.sectors.length - 3} more`}
                        </td>
                        <td className="num px-3 py-2 text-right text-ink-2">{r.activities}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {settings.mode === "replace" && (
            <label className="flex items-start gap-3 text-[14px]">
              <input
                type="checkbox"
                checked={confirmReplace}
                onChange={(e) => setConfirmReplace(e.target.checked)}
                className="mt-1 accent-[var(--danger)]"
              />
              <span>I understand the current directory will be removed and replaced by these files.</span>
            </label>
          )}

          <button
            type="button"
            onClick={commit}
            disabled={busy !== null || (settings.mode === "replace" && !confirmReplace)}
            className={`h-12 rounded-full px-7 text-[15px] font-semibold transition disabled:opacity-50 ${
              settings.mode === "replace" ? "bg-danger text-white" : "bg-accent text-accent-ink hover:bg-accent-hover"
            }`}
          >
            {busy === "importing"
              ? "Importing…"
              : busy === "reading"
                ? "Reading the files…"
                : settings.mode === "replace"
                  ? `Replace directory with ${fmt(plan.companies)} vendors`
                  : `Import ${fmt(plan.companies)} vendors`}
          </button>
        </>
      )}

      {!plan && busy === "reading" && <p className="text-[14px] text-ink-2">Reading the files…</p>}
    </div>
  );
}

function SheetRow({
  source: s,
  canLeaveOut,
  open,
  onToggleOpen,
  onLeaveOut,
  onColumn,
  onLayout,
}: {
  source: ImportSource;
  canLeaveOut: boolean;
  open: boolean;
  onToggleOpen: () => void;
  onLeaveOut: () => void;
  onColumn: (field: Field, value: string) => void;
  onLayout: (layout: Layout) => void;
}) {
  const matched = FIELDS.filter(([f]) => s.map[f] != null).length;
  return (
    <li className={`rounded-xl border px-3.5 py-2.5 ${s.needsMapping && !s.left ? "border-danger bg-danger-soft" : "border-line"} ${s.left ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="min-w-0 flex-1 text-[13px]">
          <span className="font-medium text-ink">Sheet “{s.sheetName}”</span>
          <span className="text-ink-3">
            , {plural(s.rowCount, "row")}
            {!s.needsMapping && <>, {plural(s.companies, "company", "companies")}</>}
          </span>
        </p>
        {s.left ? (
          <span className="text-[12px] font-medium text-ink-3">Left out</span>
        ) : s.needsMapping ? (
          <span className="text-[12px] font-medium text-danger">Company-name column needed</span>
        ) : (
          <span className="flex items-center gap-1 text-[12px] font-medium text-ink-2">
            <CheckIcon size={14} className="text-ok" /> {plural(matched, "column")} matched
          </span>
        )}
        <div className="flex gap-1">
          {!s.left && (
            <button
              type="button"
              onClick={onToggleOpen}
              aria-expanded={open}
              className="rounded-full px-2.5 py-1 text-[12px] font-semibold text-accent-text hover:bg-accent-soft"
            >
              {open ? "Hide columns" : "Columns"}
            </button>
          )}
          {canLeaveOut && (
            <button type="button" onClick={onLeaveOut} className="rounded-full px-2.5 py-1 text-[12px] font-medium text-ink-2 hover:bg-panel-2 hover:text-ink">
              {s.left ? "Include" : "Leave out"}
            </button>
          )}
        </div>
      </div>
      {!s.left && !s.needsMapping && s.map.activities != null && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[12px] text-ink-2">
          <span className="text-ink-3">Read as</span>
          {(
            [
              ["list", "one row per company, listing all it offers"],
              ["rows", "one row per offering"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onLayout(value)}
              aria-pressed={s.layout === value}
              className={`rounded-full px-2.5 py-1 font-medium transition ${
                s.layout === value ? "bg-ink text-panel" : "ring-1 ring-line-strong hover:ring-ink"
              }`}
            >
              {label}
              {s.detectedLayout === value && s.layout !== value && " (detected)"}
            </button>
          ))}
        </div>
      )}
      {!s.left && !s.needsMapping && s.nameCutAt != null && (
        <p className="mt-2 text-[12px] leading-relaxed text-ink-2">
          This list cuts company names at {s.nameCutAt} characters. Shortened names are matched to the full name of a vendor already
          listed, or in another file, where only one fits.
        </p>
      )}
      {open && !s.left && (
        <div className="mt-3 grid gap-3 pb-1 sm:grid-cols-2">
          {FIELDS.map(([field, label]) => (
            <label key={field} className="block">
              <span className="mb-1 block text-[12px] font-medium text-ink-2">
                {label}
                {field === "name" && <span className="text-danger"> (required)</span>}
              </span>
              <select
                value={s.map[field] ?? ""}
                onChange={(e) => onColumn(field, e.target.value)}
                className="h-10 w-full rounded-lg border border-line-strong bg-panel px-2.5 text-[14px]"
              >
                <option value="">Not in this sheet</option>
                {s.headers.map((h, i) => (
                  <option key={i} value={i}>
                    {h || `Column ${i + 1}`}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
    </li>
  );
}
