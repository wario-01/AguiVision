import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
