import * as XLSX from "xlsx";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { exportVendors, parseFilters, parseSort } from "@/lib/search";
import { SECTOR_BY_ID } from "@/lib/sectors";
import { query } from "@/lib/db";

export const runtime = "nodejs";

/** The current search (or the whole directory) as an .xlsx file. */
export const GET = handle(async (request: Request) => {
  await requireUser();
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const rows = await exportVendors(parseFilters(sp), parseSort(sp));

  // The original Area of Business text and the notes, so a round trip
  // (download, edit in Excel, upload) loses nothing.
  const extra = new Map(
    (
      await query<{
        id: number;
        activities_raw: string | null;
        notes: string | null;
        activity_codes: Record<string, string>;
        associates: { name: string; country: string | null }[];
        sources: string[];
      }>(
        `select id::int, activities_raw, notes, activity_codes, associates, sources from public.vendors where id = any($1::bigint[])`,
        [rows.map((r) => r.id)],
      )
    ).map((r) => [r.id, r]),
  );

  const sheet = XLSX.utils.json_to_sheet(
    rows.map((r, i) => ({
      "#": i + 1,
      Name: r.name,
      ContactPersonEmail: r.email ?? "",
      ContactOfficeNumber: r.phone ?? "",
      Address: r.address ?? "",
      Emirate: r.emirate ?? "",
      Sectors: r.sectors.map((s) => SECTOR_BY_ID.get(s)?.name ?? s).join(", "),
      AreaOfBusiness: extra.get(r.id)?.activities_raw ?? r.activities.join(", "),
      AdditionalNotes: extra.get(r.id)?.notes ?? "",
      // Read back by an upload: "Associates" as "Name (Country); Name (Country)".
      Associates: (extra.get(r.id)?.associates ?? []).map((a) => (a.country ? `${a.name} (${a.country})` : a.name)).join("; "),
      Codes: Object.values(extra.get(r.id)?.activity_codes ?? {}).join(", "),
      ListedIn: (extra.get(r.id)?.sources ?? []).join(", "),
    })),
  );
  sheet["!cols"] = [{ wch: 6 }, { wch: 44 }, { wch: 32 }, { wch: 20 }, { wch: 40 }, { wch: 16 }, { wch: 40 }, { wch: 80 }, { wch: 60 }, { wch: 50 }, { wch: 30 }, { wch: 30 }];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Vendors");
  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const label = (sp.q || sp.sector || sp.activity || sp.emirate || "directory")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="vendors-${label || "export"}-${date}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
});
