import { classifySectors } from "@/lib/sectors";

// Turns one raw spreadsheet row into a clean vendor record. Everything that
// writes vendors (import, the add/edit form, the seed script) goes through
// normalizeVendor(), so the directory stays consistent however data arrives.

export const EMIRATES = [
  "Abu Dhabi",
  "Dubai",
  "Sharjah",
  "Ajman",
  "Umm Al Quwain",
  "Ras Al Khaimah",
  "Fujairah",
] as const;
export type Emirate = (typeof EMIRATES)[number];
export type EmirateSource = "address" | "name" | "phone" | "manual";

export type VendorInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  activities?: string | null; // the "Area of Business" free text
  emirate?: string | null; // only honoured when set by hand
  notes?: string | null; // "Additional notes", kept with its line breaks
  code?: string | null; // the offering's code in its source list, e.g. a work-group number
  associate?: string | null; // an associated company; "Name (Country); Name (Country)" also reads
  associateCountry?: string | null;
  layout?: Layout; // how the activities cell is written (see Layout)
  nameCut?: boolean; // the source list cuts long names short
  source?: string | null; // the file the row came from
};

/**
 * How a sheet writes what a company does:
 *  - "list": one row per company, the cell lists everything it does
 *    ("Trading of Valves, Pumps Maintenance, ..."), read with list repair.
 *  - "rows": one row per company and offering; the cell is a single offering,
 *    and the company repeats on as many rows as it has offerings.
 *  - "lines": one offering per line, taken exactly as written. The edit form
 *    and the Excel download use it, and any cell with several lines is read
 *    this way.
 */
export type Layout = "list" | "rows" | "lines";

export type Associate = { name: string; country: string | null };

export type NormalizedVendor = {
  name: string;
  name_key: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  activities_raw: string | null;
  activities: string[];
  sectors: string[];
  emirate: Emirate | null;
  emirate_source: EmirateSource | null;
  notes: string | null;
  activity_codes: Record<string, string>;
  associates: Associate[];
  sources: string[];
  name_cut: boolean;
  search_extra: string | null;
};

// ── text ───────────────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'",
};

/** Collapse whitespace and decode HTML entities (the source has `&amp;amp;`). */
export function cleanText(value: unknown): string | null {
  let s = String(value ?? "");
  for (let i = 0; i < 3 && /&(\w+|#\d+);/.test(s); i++) {
    s = s.replace(/&(\w+|#\d+);/g, (m, e: string) => ENTITIES[e.toLowerCase()] ?? m);
  }
  s = s.replace(/[\t\r\n ]+/g, " ").replace(/\s{2,}/g, " ").trim();
  return s === "" ? null : s;
}

export const NOTES_MAX = 5000;

/** Like cleanText, but keeps paragraphs: notes are written, not data. */
export function cleanNotes(value: unknown): string | null {
  const s = String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, NOTES_MAX);
  return s === "" ? null : s;
}

/**
 * The source system appends a stray " 235" to most addresses. Drop it, unless
 * it is genuinely a P.O. Box number.
 */
export function cleanAddress(value: unknown): string | null {
  let s = cleanText(value);
  if (!s) return null;
  if (!/\bbox\s*:?\s*235$/i.test(s)) s = s.replace(/\s+235$/, "");
  s = s.replace(/^[\s,;-]+|[\s,;-]+$/g, "");
  return s === "" ? null : s;
}

// ── activities ─────────────────────────────────────────────────────────────

// Words that make a fragment a complete activity on its own. A fragment
// without one ("Screws", "Motors and Valves and Their Accessories") is part of
// a list and gets glued back onto its neighbour.
const HEAD = String.raw`(?:trading|trade|services?|manufactur\w*|contracting|consultanc\w*|consultants?|maintenance|installations?|repair\w*|works?|sale|wholesale|retail|studies|agenc\w*|management|supply|supplies|design\w*|cleaning|transportation|transport|shipment|shipping|catering|inspection|testing|rental|hire|fabrication|workshop|engineering|importing|exporting|investment|organi[sz]ing|brokers?|charters?|chandlers?|production|processing|operation|operating|development|training|recovering|storing|drilling|coating|treatment|solutions|systems|conversion)`;
const HEAD_WORDS = new RegExp(String.raw`\b${HEAD}\b`, "i");
// The first word is itself an activity ("Installation and Maintenance of ...").
const HEAD_START = new RegExp(String.raw`^${HEAD}\b`, "i");

// "... of Pumps", "... of Electricity Generation": a list that may continue.
const OPEN_LIST_END = /\bof\s+[\w’'-]+(?:\s+[\w’'-]+)?$/i;

const SMALL_WORDS = new Set([
  "a", "an", "and", "as", "at", "by", "for", "from", "in", "into", "of", "on",
  "or", "the", "to", "via", "with",
]);

// Abbreviations that stay in capitals when a list is written all in capitals.
const ACRONYMS = new Set([
  "IT", "ICT", "HVAC", "CCTV", "LPG", "LNG", "CNG", "NGL", "MEP", "GRP", "GRE", "FRP", "HSE", "HSSE", "QHSE",
  "QA", "QC", "PLC", "DCS", "SCADA", "RTU", "UPS", "EPC", "EPCM", "NDT", "ROV", "GIS", "ERP", "SAP", "CNC",
  "PVC", "UPVC", "HDPE", "UAE", "ADNOC", "LV", "MV", "HV", "AC", "DC", "UV", "RO", "PPE", "ISO", "API", "ESP",
  "FPSO", "VSD", "VFD", "PSV", "SIL", "HAZOP", "HAZID", "CAD", "BIM", "AI", "GPS", "IP", "PCB", "LED", "IOT",
  "EOR", "O&M", "IT&T", "OEM", "SS", "MS", "CS", "GI", "DI", "TV", "PA", "LAN", "WAN", "IOS",
]);

const capitalise = (w: string) => w.replace(/(^|[/(\-])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase());

/** Consistent casing, so "Oil And Gas", "oil and gas" and "OIL AND GAS" count as one. */
export function titleCase(s: string): string {
  // A string with no lower-case letters is shouting, not a run of acronyms.
  const shouting = !/[a-z]/.test(s) && /[A-Z]{3}/.test(s);
  return s
    .split(" ")
    .map((w, i) => {
      if (!w) return w;
      if (shouting) {
        if (ACRONYMS.has(w.replace(/[^A-Z&]/g, ""))) return w;
      } else if (w.length <= 5 && /^[A-Z&]{2,}$/.test(w)) {
        // Keep short acronyms as typed: IT, HVAC, LPG, CCTV, MEP, GRP...
        return w;
      }
      const lower = w.toLowerCase();
      if (i > 0 && SMALL_WORDS.has(lower)) return lower;
      // Mixed-case text is cased exactly as it always has been, so stored
      // offerings keep matching; only shouted lists get the fuller treatment.
      return shouting ? capitalise(lower) : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/**
 * One offering from a list that has a row per offering ("ARCHITECTURE -
 * CONSULTANCY"). The dash inside becomes a colon, so the label stays one
 * offering when the vendor is edited and its text read back as a list.
 */
export function offeringLabel(raw: unknown): string | null {
  const c = cleanText(raw);
  if (!c) return null;
  const label = titleCase(c)
    .replace(/\s+[-–*]+\s*|\s*[-–*]+\s+/g, ": ")
    // Trimmed the way a list is read back, so the label survives a round trip.
    .replace(/^[\s.&*:-]+|[\s,;.&*:-]+$/g, "")
    .replace(/,\s*/g, " / ");
  return label || null;
}

/** "Name" with a country, or a written list "A (Italy); B (UAE)". */
export function parseAssociates(name: unknown, country: unknown): Associate[] {
  const n = cleanText(name);
  if (!n) return [];
  const c = cleanText(country);
  if (c) return [{ name: n, country: c }];
  return n
    .split(/\s*;\s*/)
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^(.*?)\s*\(([^()]+)\)$/);
      return m && m[1] ? { name: m[1], country: m[2] } : { name: part, country: null };
    });
}

/** Associates from two places, each company once. */
export function mergeAssociates(a: Associate[], b: Associate[]): Associate[] {
  const seen = new Set(a.map((x) => x.name.toLowerCase()));
  const out = [...a];
  for (const x of b) {
    if (seen.has(x.name.toLowerCase())) continue;
    seen.add(x.name.toLowerCase());
    out.push(x);
  }
  return out;
}

/** What else should find this vendor in a search: codes and associates. */
export function searchExtra(v: Pick<NormalizedVendor, "activity_codes" | "associates">): string | null {
  const parts = [...Object.values(v.activity_codes), ...v.associates.flatMap((a) => [a.name, a.country ?? ""])];
  const s = parts.filter(Boolean).join(" ");
  return s || null;
}

export function parseActivities(raw: string | null): string[] {
  if (!raw) return [];
  const spaced = raw
    // Entries glued together with no separator: "TradingWires", "Services)Bolts"
    .replace(/([a-z)’'.])([A-Z][a-z])/g, "$1|$2")
    .replace(/\s+[-–*]+\s*|\s*[-–*]+\s+/g, "|")
    .replace(/[,;|\n]+/g, "|")
    .replace(/\band\/or\b/gi, "and or");

  const fragments = spaced
    .split("|")
    .map((f) => f.replace(/^[\s.&*:-]+|[\s.&*:-]+$/g, "").replace(/\s{2,}/g, " "))
    .filter((f) => f.length >= 3 && /[a-z]/i.test(f));

  // Re-join list fragments with their activity. Two shapes occur:
  //   "Bolts, Screws, Nuts ... Manufacturing"  → head at the end: attach forward
  //   "Wholesale of Pumps, Motors and Valves and Outfit Trading" → the list
  //   continues an "of X" phrase: attach back.
  const out: string[] = [];
  for (let i = 0; i < fragments.length; i++) {
    const f = fragments[i];
    const prev = out.at(-1);
    const next = fragments[i + 1];
    const continuesList =
      prev != null &&
      OPEN_LIST_END.test(prev) &&
      / and /i.test(f) &&
      !HEAD_START.test(f);
    if (continuesList) {
      out[out.length - 1] = `${prev}, ${f}`;
    } else if (HEAD_WORDS.test(f)) {
      out.push(f);
    } else if (f.split(" ").length <= 3 && next) {
      fragments[i + 1] = `${f}, ${next}`;
    } else {
      out.push(f);
    }
  }

  const seen = new Set<string>();
  const result: string[] = [];
  for (const a of out) {
    const label = titleCase(a);
    const key = label.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(label);
    }
  }
  return result;
}

// ── phones & emails ────────────────────────────────────────────────────────

// UAE landline area codes → emirate. 06 also covers Ajman and Umm Al Quwain;
// the address check runs first and catches those when they are named.
const AREA_CODES: Record<string, Emirate> = {
  "2": "Abu Dhabi",
  "3": "Abu Dhabi", // Al Ain
  "4": "Dubai",
  "6": "Sharjah",
  "7": "Ras Al Khaimah",
  "9": "Fujairah",
};

/** The national number after 971 (no trunk 0), or null if not a UAE number. */
function uaeNational(phone: string): string | null {
  const first = phone.split(/\/|&|,|;|\bfax\b|\bor\b/i)[0];
  let d = first.replace(/(?:ext|extn|x)\.?\s*\d+.*$/i, "").replace(/\D/g, "");
  if (d.startsWith("00971")) d = d.slice(5);
  else if (d.startsWith("971")) d = d.slice(3);
  else if (/^\+/.test(first.trim())) return null; // another country
  else if (d.startsWith("0")) d = d.slice(1);
  if (d.startsWith("0")) d = d.slice(1); // "+971 (0)2 ..."
  // Landlines are 8 digits (2 1234567), mobiles 9 (50 1234567).
  return /^[2-9]\d{7}$|^5\d{8}$/.test(d) ? d : null;
}

export type PhoneInfo = {
  /** Dialable number for tel: links, e.g. +97125501770 */
  dial: string;
  /** Pretty form, e.g. +971 2 550 1770 */
  display: string;
  mobile: boolean;
};

export function phoneInfo(phone: string | null): PhoneInfo | null {
  if (!phone) return null;
  const n = uaeNational(phone);
  if (!n) {
    const intl = phone.match(/\+?\d[\d\s-]{6,}\d/);
    if (!intl) return null;
    const digits = intl[0].replace(/[^\d+]/g, "");
    return { dial: digits.startsWith("+") ? digits : `+${digits}`, display: intl[0].trim(), mobile: false };
  }
  const mobile = n.startsWith("5");
  const display = mobile
    ? `+971 ${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5)}`
    : `+971 ${n.slice(0, 1)} ${n.slice(1, 4)} ${n.slice(4)}`;
  return { dial: `+971${n}`, display, mobile };
}

/** Every plausible address in an email cell ("a@x.com / b@x.com; c@y.ae"). */
export function emailList(email: string | null): string[] {
  if (!email) return [];
  return (email.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []).map((e) =>
    e.toLowerCase(),
  );
}

// ── location ───────────────────────────────────────────────────────────────

// Checked in order; specific districts before emirate names so that
// "Ras Al Khaimah" isn't caught by a looser rule first. Includes the Arabic
// names and the Abu Dhabi streets the source data uses instead of a city.
const PLACE_RULES: [RegExp, Emirate][] = [
  [/\bras\s*al[\s-]*khaima?h?\b|\brak\b|\brakez\b|\bsaqr port\b|\bal hamra\b|\bal jazeera al hamra\b|رأس الخيمة/i, "Ras Al Khaimah"],
  [/\bumm\s*al[\s-]*qu?a?[iy]?wa[iy]?n\b|\buaq\b|أم القيوين/i, "Umm Al Quwain"],
  [/\bfujairah\b|\bdibba\b|الفجيرة/i, "Fujairah"],
  [/\bajman\b|عجمان/i, "Ajman"],
  [/\bsharjah\b|\bsaif\s*zone\b|\bhamriy?ah?\b|الشارقة/i, "Sharjah"],
  [/\bdubai\b|\bjebel\s*ali\b|\bjafza\b|\bal\s*quoz\b|\bjlt\b|\bjumeirah\b|\bdmcc\b|\bdeira\b|\bbur\s*dubai\b|\bbusiness\s*bay\b|\bbarsha\b|\btecom\b|\bras\s*al\s*khor\b|\bqusais\b|\bdafza\b|\bdifc\b|\bsilicon\s*oasis\b|\bgarhoud\b|\bport\s*rashid\b|\bdip\b|\binvestments?\s*park\b|\bumm?\s*ram+o+l\b|دبي/i, "Dubai"],
  [/\babu[\s-]*dhabi\b|\bmus+af+ah?\b|\bmus+af+a\b|\bicad\b|\bmafraq\b|\breem\b|\bkhalifa\s*(?:city|industrial|port|street|bin\s*za[iy]e?d)\b|\bkizad\b|\bruwais\b|\bal\s*ain\b|\bmina\s*zayed\b|\bbaniyas\b|\bmasdar\b|\byas\b|\bsaadiyat\b|\bal\s*raha\b|\bshahama\b|\bmadinat\s*zayed\b|\bbada\s*zayed\b|\bdhafra\b|\bmirfa\b|\belectra\b|\bkhalidiy+a\b|\bal\s*bateen\b|\bmbz\b|\bmohammed\s*bin\s*zayed\b|\bhamdan\s*(?:st|street|bin)\b|\bsalam\s*st(?:reet)?\b|\btourist\s*club\b|\bmarkaziya\b|\bmuroo?r\b|\bmurror\b|\bnajda\b|\bdefen[cs]e\s*(?:road|street)\b|\bsh(?:eikh|\.)?\s*rashid\s*bin\s*sa[ie]e?d\b|\bzayed\s*the\s*first\b|\bal\s*wahda\b|ظبي/i, "Abu Dhabi"],
];

const placeIn = (text: string | null): Emirate | null => {
  if (!text) return null;
  for (const [re, emirate] of PLACE_RULES) if (re.test(text)) return emirate;
  return null;
};

/** "... - Abu Dhabi", "... (Dubai)", "... Abu Dhabi Branch": the name says which branch. */
function branchIn(name: string | null): Emirate | null {
  if (!name) return null;
  const m = name.match(/[-–(,]\s*([^-–(,]+?)\)?\s*$/) ?? name.match(/\s([\p{L}\s]+?\s+branch)\s*$/iu);
  return m ? placeIn(m[1]) : null;
}

/**
 * Where a vendor is, from the strongest evidence available: the address,
 * a branch named in the company name, address text typed into the phone
 * column, then the landline area code.
 */
export function inferEmirate(
  address: string | null,
  phone: string | null,
  name: string | null = null,
): { emirate: Emirate | null; source: EmirateSource | null } {
  const fromAddress = placeIn(address);
  if (fromAddress) return { emirate: fromAddress, source: "address" };

  const fromName = branchIn(name);
  if (fromName) return { emirate: fromName, source: "name" };

  const fromPhoneText = phone && /[a-z]{3}/i.test(phone) ? placeIn(phone) : null;
  if (fromPhoneText) return { emirate: fromPhoneText, source: "address" };

  if (phone) {
    const n = uaeNational(phone);
    if (n && AREA_CODES[n[0]]) return { emirate: AREA_CODES[n[0]], source: "phone" };
  }
  return { emirate: null, source: null };
}

export function asEmirate(value: unknown): Emirate | null {
  const s = String(value ?? "").trim().toLowerCase();
  return EMIRATES.find((e) => e.toLowerCase() === s) ?? null;
}

// ── identity ───────────────────────────────────────────────────────────────

/**
 * Matching key for "is this the same company?" on import. Case, punctuation
 * and "L.L.C"/"LLC" spellings are ignored, but legal suffixes are kept: the
 * directory holds sister entities such as "ESMA Industrial Enterprises FZCO"
 * (Dubai) and "... LLC" (Abu Dhabi), and those must stay separate.
 */
export function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[.'’]/g, "")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
    .replace(/\bl l c\b/g, "llc")
    .replace(/\bco llc\b/g, "llc")
    .trim();
}

// ── assemble ───────────────────────────────────────────────────────────────

export function normalizeVendor(input: VendorInput): NormalizedVendor | null {
  const name = cleanText(input.name);
  if (!name) return null;
  const email = cleanText(input.email);
  const phone = cleanText(input.phone);
  const address = cleanAddress(input.address);
  // A one-offering-per-row list keeps each cell whole, one per line is taken
  // as written, and a company's list in one cell is split and repaired.
  const lines = String(input.activities ?? "").split(/\r?\n/).map(cleanText).filter((l): l is string => Boolean(l));
  const layout: Layout = input.layout === "rows" ? "rows" : input.layout === "lines" || lines.length >= 2 ? "lines" : "list";
  let activities: string[];
  let activities_raw: string | null;
  if (layout === "rows") {
    const single = offeringLabel(input.activities);
    activities = single ? [single] : [];
    activities_raw = single;
  } else if (layout === "lines") {
    const seen = new Set<string>();
    activities = lines.filter((l) => !seen.has(l.toLowerCase()) && seen.add(l.toLowerCase()));
    activities_raw = activities.length ? activities.join("\n") : null;
  } else {
    activities_raw = cleanText(input.activities);
    activities = parseActivities(activities_raw);
  }
  const code = cleanText(input.code);
  const activity_codes: Record<string, string> = code && activities.length === 1 ? { [activities[0]]: code } : {};
  const associates = parseAssociates(input.associate, input.associateCountry);

  const manual = asEmirate(input.emirate);
  const inferred = manual ? null : inferEmirate(address, phone, name);

  return {
    name,
    name_key: nameKey(name) || name.toLowerCase(),
    email,
    phone,
    address,
    activities_raw,
    activities,
    sectors: classifySectors(name, activities.join(" | ")),
    emirate: manual ?? inferred!.emirate,
    emirate_source: manual ? "manual" : inferred!.source,
    notes: cleanNotes(input.notes),
    activity_codes,
    associates,
    sources: input.source ? [input.source] : [],
    name_cut: Boolean(input.nameCut),
    search_extra: searchExtra({ activity_codes, associates }),
  };
}
