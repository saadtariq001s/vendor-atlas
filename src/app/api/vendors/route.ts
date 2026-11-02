import { NextResponse } from "next/server";
import { requireAdmin, requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { PAGE_SIZE, listVendors, parseFilters, parseSort } from "@/lib/search";
import { createVendor } from "@/lib/vendors";
import { vendorInput } from "@/lib/vendor-input";

/** The next page of a listing. */
export const GET = handle(async (request: Request) => {
  await requireUser();
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const offset = Math.max(0, Number(sp.offset) || 0);
  const rows = await listVendors(parseFilters(sp), parseSort(sp), offset, PAGE_SIZE);
  return NextResponse.json({ rows });
});

export const POST = handle(async (request: Request) => {
  const user = await requireAdmin();
  const id = await createVendor(vendorInput(await request.json()), user);
  return NextResponse.json({ id }, { status: 201 });
});
