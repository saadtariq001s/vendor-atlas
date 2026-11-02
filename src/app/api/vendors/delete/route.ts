import { NextResponse } from "next/server";
import { HttpError, requireAdmin } from "@/lib/auth";
import { handle } from "@/lib/api";
import { deleteVendors } from "@/lib/vendors";

/** Delete several vendors at once: { ids: number[] } */
export const POST = handle(async (request: Request) => {
  const user = await requireAdmin();
  const body = (await request.json()) as { ids?: unknown };
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is number => Number.isSafeInteger(x)) : [];
  if (ids.length === 0) throw new HttpError(400, "Select at least one vendor.");
  if (ids.length > 5000) throw new HttpError(400, "Delete at most 5,000 vendors at a time.");
  return NextResponse.json({ deleted: await deleteVendors(ids, user) });
});
