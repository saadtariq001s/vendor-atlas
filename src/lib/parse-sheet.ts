import * as XLSX from "xlsx";
import type { Layout, VendorInput } from "@/lib/normalize";

export type Field = "name" | "email" | "phone" | "address" | "activities" | "emirate" | "notes" | "code" | "associate" | "associateCountry";

export const FIELD_LABELS: Record<Field, string> = {
  name: "Company name",
  activities: "What they offer",
  code: "Offering code",
  email: "Email",
  phone: "Phone",
  address: "Address",
  emirate: "Emirate",
  associate: "Associated company",
  associateCountry: "Associate's country",
  notes: "Additional notes",
};

// Header text is compared with everything but letters and digits removed, so
// "ContactPersonEmail", "Contact Person Email" and "contact_person_email" match.
const HEADER_ALIASES: Record<Field, string[]> = {
  name: ["name", "company", "companyname", "vendor", "vendorname", "supplier", "suppliername", "organisation", "organization", "firm", "entity",
    "contractor", "contractorname", "registeredname", "tradename", "businessname", "legalname"],
  email: ["contactpersonemail", "email", "emailaddress", "contactemail", "mail", "emails"],
  phone: ["contactofficenumber", "phone", "telephone", "tel", "officenumber", "contactnumber", "phonenumber", "mobile", "landline", "contact"],
  address: ["address", "officeaddress", "location", "postaladdress", "pobox"],
  activities: ["areaofbusiness", "areasofbusiness", "activities", "businessactivities", "activity", "services", "service", "scope", "category", "categories", "businessarea", "licenseactivities", "licenceactivities",
    "workgroupdescription", "workgroup", "workgroupname", "servicedescription", "servicecategory", "productcategory", "commodity", "commoditydescription", "discipline", "scopeofwork"],
  emirate: ["emirate", "city", "region"],
  notes: ["additionalnotes", "notes", "note", "remarks", "remark", "comments", "comment"],
  code: ["workgroupnumber", "workgroupcode", "workgroupno", "offeringcode", "categorycode", "commoditycode", "activitycode", "servicecode", "code"],
  associate: ["associatename", "associate", "associates", "associatedcompany", "associatedcompanies", "principal", "principalname", "manufacturer"],
  associateCountry: ["associatecountry", "principalcountry", "manufacturercountry"],
};

const key = (v: unknown) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

export type ColumnMap = Partial<Record<Field, number>>;

// One sheet of one uploaded file, as the upload page shows it.
export type ImportSource = {
  id: string; // `${fileKey}/${sheetName}`, stable while the same files are chosen
  fileKey: string;
  fileName: string;
  sheetName: string;
  headers: string[];
  map: ColumnMap;
  rowCount: number;
  companies: number;
  needsMapping: boolean;
  left: boolean; // left out of this import by the person
  layout: Layout; // as detected, or as the person set it
  detectedLayout: Layout;
  nameCutAt: number | null; // the list cuts names at this many characters
};

export type ImportFailure = { fileKey: string; fileName: string; error: string };

export type SheetGrid = {
  sheetName: string;
  headers: string[];
  headerRow: number;
  rows: unknown[][];
  detected: ColumnMap;
};

function detectColumns(row: unknown[]): ColumnMap {
  const cells = row.map(key);
  const map: ColumnMap = {};
  for (const field of Object.keys(HEADER_ALIASES) as Field[]) {
    const idx = cells.findIndex((c) => c && HEADER_ALIASES[field].includes(c));
    if (idx !== -1) map[field] = idx;
  }
  return map;
}

/**
 * Every sheet with a recognisable header row (within its first 30 rows), so a
 * workbook that splits the directory across tabs is read whole. If no sheet
 * has one, the first non-empty sheet is returned with no columns matched, so
 * the person can map them by hand.
 */
export function readGrids(buffer: ArrayBuffer): SheetGrid[] {
  const wb = XLSX.read(buffer, { type: "array", dense: true });
  const found: SheetGrid[] = [];
  let fallback: SheetGrid | null = null;

  for (const sheetName of wb.SheetNames) {
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
      header: 1,
      defval: null,
      blankrows: false,
      raw: false,
    });
    if (grid.length === 0) continue;

    let matched = false;
    for (let r = 0; r < Math.min(grid.length, 30); r++) {
      const detected = detectColumns(grid[r] ?? []);
      if (detected.name != null) {
        found.push({
          sheetName,
          headers: (grid[r] ?? []).map((h) => String(h ?? "").trim()),
          headerRow: r,
          rows: grid.slice(r + 1),
          detected,
        });
        matched = true;
        break;
      }
    }
    if (!matched) {
      fallback ??= {
        sheetName,
        headers: (grid[0] ?? []).map((h) => String(h ?? "").trim()),
        headerRow: 0,
        rows: grid.slice(1),
        detected: {},
      };
    }
  }

  if (found.length) return found;
  if (!fallback) throw new Error("The file has no rows.");
  return [fallback];
}

/** The first sheet with vendor rows (the command-line seed script). */
export const readGrid = (buffer: ArrayBuffer): SheetGrid => readGrids(buffer)[0];

/**
 * How the sheet writes offerings. When the same company fills several rows
 * and the offering cells repeat across companies (a short list of categories,
 * like work groups), each row is one offering. Otherwise each cell is a
 * company's whole list.
 */
export function detectLayout(grid: SheetGrid, map: ColumnMap): Layout {
  const ni = map.name, ai = map.activities;
  if (ni == null || ai == null) return "list";
  const names = new Set<string>();
  const offers = new Map<string, number>();
  let filled = 0, length = 0;
  for (const row of grid.rows) {
    const n = String(row[ni] ?? "").trim();
    const a = String(row[ai] ?? "").trim();
    if (!n || !a) continue;
    names.add(n.toLowerCase());
    offers.set(a.toLowerCase(), (offers.get(a.toLowerCase()) ?? 0) + 1);
    filled++;
    length += a.length;
  }
  if (filled < 4) return "list";
  const repeatsCompanies = filled / names.size >= 1.3;
  const fewCategories = offers.size / filled <= 0.5;
  const shortCells = length / filled <= 90;
  return (repeatsCompanies && fewCategories && shortCells) || (map.code != null && fewCategories) ? "rows" : "list";
}

/**
 * Some lists cut long names at a fixed width ("HALLIBURTON WORLDWIDE
 * LIMITED-ABUDH"). Spotted when many names stop at exactly the same,
 * longest length; returns that length.
 */
export function detectNameCut(grid: SheetGrid, map: ColumnMap): number | null {
  const ni = map.name;
  if (ni == null) return null;
  const names = new Set<string>();
  for (const row of grid.rows) {
    const n = String(row[ni] ?? "").replace(/\s+$/, "");
    if (n.trim()) names.add(n);
  }
  if (names.size < 20) return null;
  const lengths = [...names].map((n) => n.length);
  const max = Math.max(...lengths);
  const atMax = lengths.filter((l) => l === max).length;
  return max >= 20 && max <= 80 && atMax / names.size >= 0.08 ? max : null;
}

export function rowsToInputs(
  grid: SheetGrid,
  map: ColumnMap,
  opts: { layout?: Layout; nameCutAt?: number | null; source?: string } = {},
): VendorInput[] {
  const pick = (row: unknown[], f: Field) => {
    const i = map[f];
    return i == null ? null : (row[i] as string | null);
  };
  return grid.rows
    .map((row): VendorInput => {
      const name = String(pick(row, "name") ?? "");
      return {
        name,
        email: pick(row, "email"),
        phone: pick(row, "phone"),
        address: pick(row, "address"),
        activities: pick(row, "activities"),
        emirate: pick(row, "emirate"),
        notes: pick(row, "notes"),
        code: pick(row, "code"),
        associate: pick(row, "associate"),
        associateCountry: pick(row, "associateCountry"),
        layout: opts.layout ?? "list",
        nameCut: opts.nameCutAt != null && name.replace(/\s+$/, "").length >= opts.nameCutAt,
        source: opts.source ?? null,
      };
    })
    .filter((r) => r.name.trim() !== "");
}
