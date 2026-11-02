// Load a spreadsheet into the directory from the command line, the same way
// the Upload data screen does (every sheet, its shape and cut names worked
// out the same way). Useful for the first big load.
//   npm run db:seed -- path/to/vendors.xlsx [merge|replace]
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { detectLayout, detectNameCut, readGrids, rowsToInputs } from "../src/lib/parse-sheet";
import { applyImport, planImport, type ImportMode } from "../src/lib/vendors";
import { endPool } from "../src/lib/db";

const [file, modeArg = "merge"] = process.argv.slice(2);
if (!file || !["merge", "replace"].includes(modeArg)) {
  console.error("usage: npm run db:seed -- <file.xlsx|.csv> [merge|replace]");
  process.exit(1);
}
const mode = modeArg as ImportMode;

const buf = readFileSync(file);
const grids = readGrids(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)).filter((g) => g.detected.name != null);
if (grids.length === 0) {
  console.error("No sheet with a company-name column was found.");
  process.exit(1);
}
const inputs = grids.flatMap((g) => {
  const layout = detectLayout(g, g.detected);
  const nameCutAt = detectNameCut(g, g.detected);
  console.log(`  sheet "${g.sheetName}": ${g.rows.length} rows, one row per ${layout === "rows" ? "offering" : "company"}${nameCutAt ? `, names cut at ${nameCutAt}` : ""}`);
  return rowsToInputs(g, g.detected, { layout, nameCutAt, source: basename(file) });
});
const plan = await planImport(inputs, mode);
console.log(
  `${basename(file)} ▸ ${plan.vendors.length} companies (${plan.inserts} new, ${plan.updates} existing, ` +
    `${plan.mergedInFile} duplicate rows folded, ${plan.byShortName} matched by a shortened name, ${plan.skipped} skipped)`,
);
const result = await applyImport(plan, mode, null, basename(file));
console.log(`Done: ${result.inserted} added, ${result.updated} updated${mode === "replace" ? `, ${result.removed} replaced` : ""}.`);
await endPool();
