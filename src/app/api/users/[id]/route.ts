import { NextResponse } from "next/server";
import { HttpError, requireAdmin } from "@/lib/auth";
import { handle } from "@/lib/api";
import { query } from "@/lib/db";

export const DELETE = handle(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const me = await requireAdmin();
  const { id } = await params;
  if (id === me.id) throw new HttpError(400, "You can't remove your own account.");
  const rows = await query(`delete from public.app_users where id::text = $1 returning id`, [id]);
  if (rows.length === 0) throw new HttpError(404, "That account was already removed.");
  return NextResponse.json({ ok: true });
});
