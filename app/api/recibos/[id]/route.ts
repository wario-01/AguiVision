import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFinanceAccess } from "@/lib/finance";

// PATCH /api/recibos/:id  body: { reason }  → anula el recibo (no se borra; queda el registro).
// Solo el superusuario.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const access = await getFinanceAccess();
  if (!access || access.level !== "owner") {
    return NextResponse.json({ error: "Solo el superusuario puede anular recibos" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 200) : "";
  if (!reason) return NextResponse.json({ error: "Escribe el motivo de la anulación" }, { status: 400 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Falta configurar el servidor" }, { status: 500 });
  const { data, error } = await admin
    .from("receipts")
    .update({ voided: true, void_reason: reason, voided_by: access.email })
    .eq("id", params.id)
    .eq("voided", false)
    .select("id");
  if (error || !data || data.length === 0) {
    return NextResponse.json({ error: "No se pudo anular (¿ya estaba anulado?)" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
