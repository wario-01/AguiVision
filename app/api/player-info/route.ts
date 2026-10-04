import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

const PERFILES = ["derecho", "izquierdo", "ambidiestro"];

// POST /api/player-info
// json: { playerId, jersey_number, position, peso, altura, perfil }
// Solo coach/assistant del equipo de ese jugador puede editar sus datos.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.playerId !== "string") {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const { playerId, jersey_number, position, peso, altura, perfil } = body;

  if (perfil != null && !PERFILES.includes(perfil)) {
    return NextResponse.json({ error: "Perfil inválido" }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 });
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Tenés que iniciar sesión" }, { status: 401 });
  }

  const { data: player } = await supabase.from("players").select("id, team_id").eq("id", playerId).single();
  if (!player) {
    return NextResponse.json({ error: "Jugador no encontrado" }, { status: 404 });
  }

  const { data: membership } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", player.team_id)
    .eq("profile_id", userData.user.id)
    .maybeSingle();

  if (!membership || (membership.role !== "coach" && membership.role !== "assistant")) {
    return NextResponse.json({ error: "No tenés permiso para editar este jugador" }, { status: 403 });
  }

  if (!isAdminConfigured) {
    return NextResponse.json({ error: "Falta configurar el almacenamiento" }, { status: 500 });
  }
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Falta configurar el almacenamiento" }, { status: 500 });
  }

  const { error: updateError } = await admin
    .from("players")
    .update({
      jersey_number: jersey_number === "" || jersey_number == null ? null : Number(jersey_number),
      position: position === "" || position == null ? null : String(position),
      peso: peso === "" || peso == null ? null : Number(peso),
      altura: altura === "" || altura == null ? null : Number(altura),
      perfil: perfil === "" || perfil == null ? null : String(perfil),
    })
    .eq("id", player.id);

  if (updateError) {
    return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
