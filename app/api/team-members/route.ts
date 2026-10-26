import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

// DELETE /api/team-members
// body: { memberId }
// RLS exige que quien llama sea coach/assistant del mismo equipo — si no
// lo es, la base de datos rechaza el delete solo (no hace falta chequearlo
// dos veces acá).
export async function DELETE(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.memberId) {
    return NextResponse.json({ error: "Falta el id del miembro" }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 });
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Tenés que iniciar sesión" }, { status: 401 });
  }

  const { data: target } = await supabase
    .from("team_members")
    .select("team_id, role, profile_id")
    .eq("id", body.memberId)
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
  }
  if (target.profile_id === userData.user.id) {
    return NextResponse.json({ error: "No podés quitarte a vos mismo del equipo" }, { status: 400 });
  }
  // Un asistente no puede quitar a un entrenador ni a otro asistente.
  const { data: me } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", target.team_id)
    .eq("profile_id", userData.user.id)
    .maybeSingle();
  if (me?.role === "assistant" && (target.role === "coach" || target.role === "assistant")) {
    return NextResponse.json({ error: "Solo el entrenador puede quitar entrenadores o asistentes" }, { status: 403 });
  }

  const { data: deleted, error } = await supabase
    .from("team_members")
    .delete()
    .eq("id", body.memberId)
    .select("id");
  if (error || !deleted || deleted.length === 0) {
    return NextResponse.json({ error: "No tenés permiso para quitar a este miembro" }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}

// PATCH /api/team-members
// body: { memberId, photoAccess: boolean }
// Da o quita el permiso de fotos a una madre/padre sin cambiarle el rol.
// Solo entrenador/asistente del mismo equipo. La tabla no tiene política de
// UPDATE, así que se usa el cliente admin DESPUÉS de verificar el rol.
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.memberId || typeof body.photoAccess !== "boolean") {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 });
  }
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Tenés que iniciar sesión" }, { status: 401 });
  }

  const { data: target } = await supabase
    .from("team_members")
    .select("team_id, role")
    .eq("id", body.memberId)
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
  }
  if (target.role !== "parent") {
    return NextResponse.json({ error: "Este permiso es solo para madres y padres" }, { status: 400 });
  }

  const { data: me } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", target.team_id)
    .eq("profile_id", userData.user.id)
    .maybeSingle();
  if (!me || (me.role !== "coach" && me.role !== "assistant")) {
    return NextResponse.json({ error: "No tenés permiso para cambiar esto" }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!isAdminConfigured || !admin) {
    return NextResponse.json({ error: "Falta configurar el servidor" }, { status: 500 });
  }
  const { data: updated, error } = await admin
    .from("team_members")
    .update({ photo_access: body.photoAccess })
    .eq("id", body.memberId)
    .eq("team_id", target.team_id)
    .select("id");
  if (error || !updated || updated.length === 0) {
    return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
