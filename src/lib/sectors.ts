// The sector taxonomy. Every vendor is classified into zero or more sectors
// from its name and its "Area of Business" text, so a search for a broad word
// ("construction", "shipping", "IT") also finds vendors that never use that
// exact word but plainly work in that field.
//
// Ids are stored in the database (vendors.sectors) and appear in URLs, so
// rename `name` freely but treat `id` as permanent. After changing patterns,
// run `npm run db:reclassify` to re-apply them to existing rows.

export type Sector = {
  id: string;
  name: string;
  /**
   * Words that, typed on their own, mean "this whole sector". Only names for
   * the sector itself belong here; a product word like "valves" must not
   * expand to every mechanical vendor.
   */
  aliases: string[];
  /** Matched against the lower-cased name + activities text. */
  pattern: RegExp;
};

const words = (list: string[]) =>
  new RegExp(`\\b(?:${list.join("|")})`, "i");

export const SECTORS: Sector[] = [
  {
    id: "oil-gas",
    name: "Oil & gas",
    aliases: ["oil", "gas", "oil and gas", "oil & gas", "petroleum", "energy", "upstream", "offshore", "onshore"],
    pattern: words([
      "oil", "natural gas", "petroleum", "petrochemical", "drilling", "well ",
      "wells", "oilfield", "oil field", "pipeline", "refiner", "lpg", "lng",
      "upstream", "downstream", "reservoir",
    ]),
  },
  {
    id: "construction",
    name: "Construction & contracting",
    aliases: ["construction", "contracting", "contractor", "contractors", "building", "civil", "fit out", "fitout"],
    pattern: words([
      "construct", "contracting", "building", "civil", "concrete", "precast",
      "demolition", "fit[- ]?out", "interior design implementation",
      "decor", "asphalt", "scaffold", "steel structure", "joinery",
      "plaster", "gypsum", "tiling", "masonry", "blocks?\\b", "cement",
      "aggregate", "excavat", "earth ?work", "piling", "waterproof",
      "insulation", "aluminium", "carpentry", "paint",
    ]),
  },
  {
    id: "engineering",
    name: "Engineering & consultancy",
    aliases: ["engineering", "consultancy", "consultant", "consultants", "consulting"],
    pattern: words([
      "consultan", "engineering", "studies", "feasibility", "project management",
      "projects management", "survey",
    ]),
  },
  {
    id: "electrical",
    name: "Electrical & power",
    aliases: ["electrical", "electric", "power", "electricity", "energy"],
    pattern: words([
      "electric", "power", "cable", "wire", "wiring", "transformer", "generator",
      "switchgear", "lighting", "solar", "renewable", "alternative energy",
      "battery", "batteries", "substation", "ups ",
    ]),
  },
  {
    id: "mechanical",
    name: "Mechanical & equipment",
    aliases: ["mechanical", "machinery", "mechanical equipment", "mep"],
    pattern: words([
      "mechanical", "pump", "valve", "compressor", "turbine", "machiner",
      "heavy equipment", "equipments? (?:repair|rental|hire|maintenance)",
      "hydraulic", "pneumatic", "bearing", "air[- ]condition", "hvac", "mep",
      "crane", "lifting", "boiler", "heat exchanger", "engines?\\b",
      "instrumentation", "measurement and control",
    ]),
  },
  {
    id: "manufacturing",
    name: "Manufacturing & fabrication",
    aliases: ["manufacturing", "manufacturer", "manufacturers", "fabrication", "factory", "factories"],
    pattern: words([
      "manufactur", "fabricat", "workshop", "welding", "foundry", "lathe",
      "machining", "factory", "assembl",
      "coating", "galvaniz", "forging", "casting",
    ]),
  },
  {
    id: "logistics",
    name: "Logistics & transport",
    aliases: ["logistics", "transport", "transportation", "shipping", "freight", "cargo"],
    pattern: words([
      "shipment", "shipping", "freight", "cargo", "logistic",
      "transport(?!(?:ation)? consultan)",
      "customs", "clearance", "storehouse", "storage", "warehous", "courier",
      "loading", "offloading", "packaging", "wrapping", "delivery",
    ]),
  },
  {
    id: "marine",
    name: "Marine & offshore",
    aliases: ["marine", "maritime"],
    pattern: words([
      "marine", "maritime", "ships?\\b", "shipyard", "vessel", "boat",
      "barge", "tugs?\\b", "ports?\\b", "dredg", "diving", "sea ", "chandler",
      "docks?\\b", "dry ?dock", "harbou?r",
    ]),
  },
  {
    id: "it-telecom",
    name: "IT & telecom",
    aliases: ["it", "tech", "technology", "telecom", "telecoms", "telecommunication", "telecommunications", "digital"],
    pattern: words([
      "information technology", "computer", "software", "networking",
      "network services", "data network", "telecommunication", "telecom",
      "data", "cyber", "systems integration", "it consultancy", "it services",
      "digital", "internet", "website", "web ", "programming", "electronic",
      "radios?\\b",
    ]),
  },
  {
    id: "safety",
    name: "Safety, fire & security",
    aliases: ["safety", "fire", "security", "hse", "fire and safety", "fire & safety"],
    pattern: words([
      "safety", "fire", "security", "surveillance", "protective", "ppe",
      "guard", "alarm", "rescue", "hse", "first aid", "cctv",
    ]),
  },
  {
    id: "environment",
    name: "Environment, waste & water",
    aliases: ["environment", "environmental", "waste", "waste management"],
    pattern: words([
      "waste", "environment", "recycl", "sewage", "sewerage", "pollution",
      "garbage", "water", "desalination", "irrigation", "purification",
      "pest control", "afforestation", "landscap",
    ]),
  },
  {
    id: "inspection",
    name: "Inspection & testing",
    aliases: ["inspection", "testing", "inspection and testing", "certification", "qa", "qc"],
    pattern: words([
      "inspection", "testing", "test", "calibration", "certification", "ndt",
      "non[- ]destructive", "laborator", "quality control", "corrosion",
    ]),
  },
  {
    id: "facilities",
    name: "Facilities management",
    aliases: ["facilities", "facilities management", "facility management", "fm"],
    pattern: words([
      "buildings maintenance", "building maintenance", "facilit(?:y|ies) management",
      "cleaning", "housekeeping", "pest control", "laundry", "janitor",
      "general maintenance",
    ]),
  },
  {
    id: "hospitality",
    name: "Hospitality & catering",
    aliases: ["hospitality", "catering", "food"],
    pattern: words([
      "catering", "food", "meal", "restaurant", "hotel", "hospitality",
      "accommodation", "camp", "cafeteria", "kitchen", "rotana", "resort",
    ]),
  },
  {
    id: "trading",
    name: "Trading & supply",
    aliases: ["trading", "supply", "suppliers", "supplier", "wholesale", "distribution"],
    pattern: words([
      "trading", "wholesale", "retail", "supply", "supplies", "importing",
      "exporting", "commercial agenc", "distributors?\\b", "general trading",
    ]),
  },
  {
    id: "materials",
    name: "Chemicals & materials",
    aliases: ["chemicals", "chemical", "materials"],
    pattern: words([
      "chemical", "plastic", "rubber", "lubricant", "steel", "metal",
      "polymer", "resin", "gases", "paints", "fibreglass", "fiberglass", "grp",
    ]),
  },
  {
    id: "real-estate",
    name: "Real estate & investment",
    aliases: ["real estate", "property", "properties", "investment", "investments"],
    pattern: words([
      "real estate", "property", "properties", "investment", "leasing",
      "real estate development", "property development",
    ]),
  },
  {
    id: "business-services",
    name: "Business services",
    aliases: ["business services", "professional services"],
    pattern: words([
      "manpower", "recruit", "labour supply", "labor supply", "training",
      "conference", "seminar", "event", "exhibition", "advertis", "printing",
      "translation", "legal", "accounting", "auditing", "insurance", "travel",
      "tourism", "administrative", "human resource", "marketing",
    ]),
  },
  {
    id: "healthcare",
    name: "Healthcare & medical",
    aliases: ["healthcare", "health", "medical"],
    pattern: words([
      "medical", "clinic", "pharma", "hospital", "healthcare", "health care",
      "dental", "drug", "occupational health",
    ]),
  },
  {
    id: "automotive",
    name: "Vehicles & fleet",
    aliases: ["automotive", "vehicles", "vehicle", "fleet"],
    pattern: words([
      "vehicle", "automobile", "car rental", "cars ", "truck", "tyre", "tire",
      "fleet", "auto spare", "motor vehicle", "rented buses", "bus ",
    ]),
  },
];

export const SECTOR_BY_ID = new Map(SECTORS.map((s) => [s.id, s]));

/** Sector ids for a vendor, in taxonomy order. */
export function classifySectors(name: string, activitiesText: string): string[] {
  const text = ` ${name} ${activitiesText} `.toLowerCase();
  return SECTORS.filter((s) => s.pattern.test(text)).map((s) => s.id);
}

/**
 * Sectors a free-text query refers to as a whole, e.g. "construction" or
 * "oil and gas". Only whole-query matches count: "steel pipes" should search
 * for steel pipes, not expand to every materials vendor.
 */
export function sectorsForQuery(query: string): string[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!q) return [];
  return SECTORS.filter(
    (s) => s.aliases.includes(q) || s.name.toLowerCase() === q || s.id === q,
  ).map((s) => s.id);
}
