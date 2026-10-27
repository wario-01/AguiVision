import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFinanceAccess } from "@/lib/finance";

async function owner() {
  const a = await getFinanceAccess();
  return a && a.level === "owner" ? a : null;
}

// POST /api/recibos/accesos  body: { email, fullName, level: "owner" | "admin", canIssue: boolean }
export async function POST(req: Request) {
  if (!(await owner())) return NextResponse.json({ error: "Solo el superusuario" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim().slice(0, 60) : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200 || !fullName) {
    return NextResponse.json({ error: "Escribe un correo válido y el nombre" }, { status: 400 });
  }
  if (body.level !== "admin" && body.level !== "owner") {
    return NextResponse.json({ error: "Nivel inválido" }, { status: 400 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Falta configurar el servidor" }, { status: 500 });
  // Un superusuario existente no se modifica desde aquí.
  const { data: existing } = await admin.from("finance_access").select("level").eq("email", email).maybeSingle();
  if (existing?.level === "owner") return NextResponse.json({ error: "Esa persona ya es superusuario" }, { status: 400 });
  const { error } = await admin
    .from("finance_access")
    .upsert({ email, full_name: fullName, level: body.level, can_issue: body.canIssue === true }, { onConflict: "email" });
  if (error) return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// PATCH /api/recibos/accesos  body: { id, canIssue: boolean } → da o quita el permiso de expedir recibos
export async function PATCH(req: Request) {
  if (!(await owner())) return NextResponse.json({ error: "Solo el superusuario" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body?.id || typeof body.canIssue !== "boolean") return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Falta configurar el servidor" }, { status: 500 });
  const { data, error } = await admin.from("finance_access").update({ can_issue: body.canIssue }).eq("id", body.id).select("id");
  if (error || !data || data.length === 0) return NextResponse.json({ error: "No se pudo actualizar" }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/recibos/accesos  body: { id }  (los superusuarios no se quitan desde aquí)
export async function DELETE(req: Request) {
  if (!(await owner())) return NextResponse.json({ error: "Solo el superusuario" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Falta el id" }, { status: 400 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Falta configurar el servidor" }, { status: 500 });
  const { data, error } = await admin
    .from("finance_access")
    .delete()
    .eq("id", body.id)
    .neq("level", "owner")
    .select("id");
  if (error || !data || data.length === 0) return NextResponse.json({ error: "No se pudo quitar" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
