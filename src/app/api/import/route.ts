import { NextResponse } from "next/server";
import { HttpError, requireAdmin } from "@/lib/auth";
import { handle } from "@/lib/api";
import { cleanText, nameKey } from "@/lib/normalize";
import {
  type ColumnMap,
  type Field,
  FIELD_LABELS,
  type ImportFailure,
  type ImportSource,
  detectLayout,
  detectNameCut,
  readGrids,
  rowsToInputs,
  type SheetGrid,
} from "@/lib/parse-sheet";
import { SECTOR_BY_ID } from "@/lib/sectors";
import { applyImport, planImport, type ImportMode } from "@/lib/vendors";
import type { Layout, VendorInput } from "@/lib/normalize";

export const runtime = "nodejs";

const MB = 1024 * 1024;
const MAX_FILE = 25 * MB;
const MAX_TOTAL = 80 * MB; // stays under the 100 MB a Cloudflare tunnel accepts
const MAX_FILES = 20;

function parseJson<T>(value: FormDataEntryValue | null, fallback: T): T {
  if (typeof value !== "string" || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new HttpError(400, "The import request was malformed. Reload the page and try again.");
  }
}

function cleanMap(raw: unknown, width: number): ColumnMap {
  const map: ColumnMap = {};
  if (!raw || typeof raw !== "object") return map;
  for (const f of Object.keys(FIELD_LABELS) as Field[]) {
    const i = (raw as Record<string, unknown>)[f];
    if (Number.isInteger(i) && (i as number) >= 0 && (i as number) < width) map[f] = i as number;
  }
  return map;
}

const companyKey = (name: string) => {
  const n = cleanText(name);
  return n ? nameKey(n) || n.toLowerCase() : null;
};

/**
 * Called with the chosen files every time the person changes something: first
 * to preview what will happen, then with commit=1 to apply it. Nothing is
 * stored in between. Several files, and several sheets in one workbook, are
 * read as one import, so a company listed in two of them becomes one vendor.
 */
export const POST = handle(async (request: Request) => {
  const user = await requireAdmin();
  const form = await request.formData();
  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  const keys = form.getAll("key").map(String);
  if (files.length === 0) throw new HttpError(400, "Choose a spreadsheet to import.");
  if (files.length > MAX_FILES) throw new HttpError(413, `Import up to ${MAX_FILES} files at a time.`);
  const big = files.find((f) => f.size > MAX_FILE);
  if (big) throw new HttpError(413, `${big.name} is over 25 MB. Split it into smaller files.`);
  if (files.reduce((n, f) => n + f.size, 0) > MAX_TOTAL) {
    throw new HttpError(413, "These files add up to more than 80 MB. Import them in two batches.");
  }

  const mode: ImportMode = form.get("mode") === "replace" ? "replace" : "merge";
  const maps = parseJson<Record<string, unknown>>(form.get("maps"), {});
  const leaveOut = new Set(parseJson<string[]>(form.get("skip"), []).map(String));
  const layouts = parseJson<Record<string, unknown>>(form.get("layouts"), {});

  const sources: ImportSource[] = [];
  const failed: ImportFailure[] = [];
  const inputs: VendorInput[] = [];
  const seenIn = new Map<string, string>(); // company key → first source id
  const inSeveral = new Set<string>();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileKey = keys[i] || String(i);
    let grids: SheetGrid[];
    try {
      grids = readGrids(await file.arrayBuffer());
    } catch {
      failed.push({ fileKey, fileName: file.name, error: "couldn't be read. Save it as .xlsx or .csv and try again." });
      continue;
    }
    for (const grid of grids) {
      const id = `${fileKey}/${grid.sheetName}`;
      const map = id in maps ? cleanMap(maps[id], grid.headers.length) : grid.detected;
      const left = leaveOut.has(id);
      // How the sheet writes offerings, and whether it cuts names short.
      const detectedLayout = detectLayout(grid, map);
      const layout: Layout = layouts[id] === "rows" || layouts[id] === "list" ? (layouts[id] as Layout) : detectedLayout;
      const nameCutAt = detectNameCut(grid, map);
      const rows = map.name == null ? [] : rowsToInputs(grid, map, { layout, nameCutAt, source: file.name });
      const keysHere = new Set(rows.map((r) => companyKey(r.name)).filter((k): k is string => k != null));
      if (!left) {
        inputs.push(...rows);
        for (const k of keysHere) {
          const first = seenIn.get(k);
          if (first == null) seenIn.set(k, id);
          else if (first !== id) inSeveral.add(k);
        }
      }
      sources.push({
        id,
        fileKey,
        fileName: file.name,
        sheetName: grid.sheetName,
        headers: grid.headers,
        map,
        rowCount: grid.rows.length,
        companies: keysHere.size,
        needsMapping: map.name == null,
        left,
        layout,
        detectedLayout,
        nameCutAt,
      });
    }
  }

  const active = sources.filter((s) => !s.left);
  const ready = failed.length === 0 && active.length > 0 && active.every((s) => !s.needsMapping);
  const commit = form.get("commit") === "1";

  if (!ready) {
    if (commit) {
      throw new HttpError(
        422,
        failed.length
          ? `Remove ${failed[0].fileName} first; it ${failed[0].error}`
          : active.length === 0
            ? "Every sheet is left out. Include at least one."
            : "Pick the company-name column for every sheet first.",
      );
    }
    return NextResponse.json({ sources, failed, plan: null });
  }

  const plan = await planImport(inputs, mode);

  if (!commit) {
    return NextResponse.json({
      sources,
      failed,
      plan: {
        companies: plan.vendors.length,
        inserts: plan.inserts,
        updates: plan.updates,
        enriched: plan.enriched,
        mergedInFile: plan.mergedInFile,
        inSeveral: inSeveral.size,
        skipped: plan.skipped,
        withNotes: plan.vendors.filter((v) => v.notes).length,
        withAssociates: plan.vendors.filter((v) => v.associates.length).length,
        withCodes: plan.vendors.filter((v) => Object.keys(v.activity_codes).length).length,
        byShortName: plan.byShortName,
        renamed: plan.renamed,
        stillShort: plan.stillShort,
        sample: plan.vendors.slice(0, 5).map((v) => ({
          name: v.name,
          emirate: v.emirate,
          sectors: v.sectors.map((s) => SECTOR_BY_ID.get(s)?.name ?? s),
          activities: v.activities.length,
        })),
      },
    });
  }

  if (plan.vendors.length === 0) throw new HttpError(422, "No rows with a company name were found.");
  const names = [...new Set(active.map((s) => s.fileName))];
  const label = names.length === 1 ? names[0] : `${names.length} files (${names.join(", ")})`;
  const result = await applyImport(plan, mode, user, label.length > 240 ? `${label.slice(0, 237)}…` : label);
  return NextResponse.json(result);
});
