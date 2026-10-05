import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { parsePlayerFields, parseFullName } from "@/lib/playerFields";

// Devuelve el usuario y verifica que sea coach/assistant del equipo dado.
async function requireStaff(teamId: string) {
  const supabase = await createClient();
  if (!supabase) {
    return { error: NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 }) };
  }
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { error: NextResponse.json({ error: "Tenés que iniciar sesión" }, { status: 401 }) };
  }
  const { data: membership } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("profile_id", userData.user.id)
    .maybeSingle();
  if (!membership || (membership.role !== "coach" && membership.role !== "assistant")) {
    return { error: NextResponse.json({ error: "No tenés permiso en este equipo" }, { status: 403 }) };
  }
  if (!isAdminConfigured) {
    return { error: NextResponse.json({ error: "Falta configurar el servidor" }, { status: 500 }) };
  }
  const admin = createAdminClient();
  if (!admin) {
    return { error: NextResponse.json({ error: "Falta configurar el servidor" }, { status: 500 }) };
  }
  return { supabase, admin };
}

// POST /api/players
// json: { teamId, full_name, jersey_number, position, peso, altura, perfil }
// Crea un jugador nuevo en el equipo. Solo coach/assistant de ese equipo.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.teamId !== "string") {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const name = parseFullName(body.full_name);
  if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });

  const parsed = parsePlayerFields(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const auth = await requireStaff(body.teamId);
  if ("error" in auth) return auth.error;

  const { jersey_number, position, peso, altura, perfil } = parsed.fields;

  const { data, error } = await auth.admin
    .from("players")
    .insert({ team_id: body.teamId, full_name: name.name, jersey_number, position })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "No se pudo crear el jugador" }, { status: 500 });
  }

  // Peso, altura y perfil van a una tabla aparte, solo visible para staff.
  if (peso !== null || altura !== null || perfil !== null) {
    const { error: privateError } = await auth.admin
      .from("player_private")
      .insert({ player_id: data.id, peso, altura, perfil });
    if (privateError) {
      return NextResponse.json({ error: "El jugador se creó, pero no se pudieron guardar peso/altura/perfil" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, id: data.id });
}

// DELETE /api/players
// json: { playerId }
// Borra al jugador y, en cascada, sus evaluaciones. Los highlights quedan
// sin jugador asignado y las invitaciones/vínculos pierden la liga.
export async function DELETE(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.playerId !== "string") {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 });
  }

  const { data: player } = await supabase.from("players").select("id, team_id").eq("id", body.playerId).single();
  if (!player) {
    return NextResponse.json({ error: "Jugador no encontrado" }, { status: 404 });
  }

  const auth = await requireStaff(player.team_id);
  if ("error" in auth) return auth.error;

  const { error } = await auth.admin.from("players").delete().eq("id", player.id);
  if (error) {
    return NextResponse.json({ error: "No se pudo borrar el jugador" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
