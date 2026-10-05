import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { parsePlayerFields, parseFullName } from "@/lib/playerFields";

// POST /api/player-info
// json: { playerId, full_name?, jersey_number, position, peso, altura, perfil }
// Solo coach/assistant del equipo de ese jugador puede editar sus datos.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.playerId !== "string") {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const parsed = parsePlayerFields(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  let newName: string | null = null;
  if (body.full_name !== undefined) {
    const n = parseFullName(body.full_name);
    if (!n.ok) return NextResponse.json({ error: n.error }, { status: 400 });
    newName = n.name;
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 });
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Tenés que iniciar sesión" }, { status: 401 });
  }

  const { data: player } = await supabase.from("players").select("id, team_id").eq("id", body.playerId).single();
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
    return NextResponse.json({ error: "Falta configurar el servidor" }, { status: 500 });
  }
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Falta configurar el servidor" }, { status: 500 });
  }

  const { jersey_number, position, peso, altura, perfil } = parsed.fields;

  const update: Record<string, unknown> = { jersey_number, position };
  if (newName) update.full_name = newName;

  const { error: updateError } = await admin.from("players").update(update).eq("id", player.id);
  if (updateError) {
    return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  }

  // Peso, altura y perfil van a una tabla aparte, solo visible para staff.
  const { error: privateError } = await admin
    .from("player_private")
    .upsert({ player_id: player.id, peso, altura, perfil, updated_at: new Date().toISOString() });
  if (privateError) {
    return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
