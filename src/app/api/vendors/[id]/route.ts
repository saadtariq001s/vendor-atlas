import { NextResponse } from "next/server";
import { HttpError, requireAdmin, requireUser } from "@/lib/auth";
import { handle, idParam } from "@/lib/api";
import { getVendor } from "@/lib/search";
import { deleteVendors, updateVendor } from "@/lib/vendors";
import { vendorInput } from "@/lib/vendor-input";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_request: Request, { params }: Ctx) => {
  await requireUser();
  const vendor = await getVendor(idParam((await params).id));
  if (!vendor) throw new HttpError(404, "That vendor is no longer in the directory.");
  return NextResponse.json(vendor);
});

export const PATCH = handle(async (request: Request, { params }: Ctx) => {
  const user = await requireAdmin();
  await updateVendor(idParam((await params).id), vendorInput(await request.json()), user);
  return NextResponse.json({ ok: true });
});

export const DELETE = handle(async (_request: Request, { params }: Ctx) => {
  const user = await requireAdmin();
  const n = await deleteVendors([idParam((await params).id)], user);
  if (n === 0) throw new HttpError(404, "That vendor was already deleted.");
  return NextResponse.json({ deleted: n });
});
