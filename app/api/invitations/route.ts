import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

// POST /api/invitations
// body: { teamSlug, email, role }
// Crea una invitación pendiente. RLS exige que quien llama sea coach/assistant
// de ese equipo — si no lo es, la base de datos rechaza el insert solo.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.teamSlug || !body?.email || !body?.role) {
    return NextResponse.json({ error: "Faltan datos de la invitación" }, { status: 400 });
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Modo demo: Supabase no está configurado." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    return NextResponse.json({ error: "Correo inválido" }, { status: 400 });
  }
  if (!["coach", "assistant", "player", "parent"].includes(body.role)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 });
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Tenés que iniciar sesión" }, { status: 401 });
  }

  const { data: team } = await supabase
    .from("teams")
    .select("id")
    .eq("slug", body.teamSlug)
    .single();

  if (!team) {
    return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
  }

  // Solo el entrenador principal puede dar rol de entrenador o asistente;
  // un asistente solo puede invitar jugadores y familias.
  const { data: me } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", team.id)
    .eq("profile_id", userData.user.id)
    .maybeSingle();
  if (!me || (me.role !== "coach" && me.role !== "assistant")) {
    return NextResponse.json({ error: "No tenés permiso para invitar a este equipo" }, { status: 403 });
  }
  if (me.role === "assistant" && (body.role === "coach" || body.role === "assistant")) {
    return NextResponse.json({ error: "Solo el entrenador puede invitar entrenadores o asistentes" }, { status: 403 });
  }

  let playerId: string | null = null;
  const playerName = typeof body.playerName === "string" ? body.playerName.trim().slice(0, 100) : "";
  if (playerName) {
    const { data: existingPlayer } = await supabase
      .from("players")
      .select("id")
      .eq("team_id", team.id)
      .eq("full_name", playerName)
      .maybeSingle();

    if (existingPlayer) {
      playerId = existingPlayer.id;
    } else {
      const { data: newPlayer, error: playerError } = await supabase
        .from("players")
        .insert({ team_id: team.id, full_name: playerName })
        .select("id")
        .single();
      if (playerError || !newPlayer) {
        return NextResponse.json({ error: "No tenés permiso para agregar jugadores a este equipo" }, { status: 403 });
      }
      playerId = newPlayer.id;
    }
  }

  const { error } = await supabase.from("team_invitations").insert({
    team_id: team.id,
    email,
    role: body.role,
    player_id: playerId,
  });

  if (error) {
    return NextResponse.json({ error: "No se pudo crear la invitación (¿ya existía?)" }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/invitations
// body: { invitationId }
export async function DELETE(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.invitationId) {
    return NextResponse.json({ error: "Falta el id de la invitación" }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 });
  }

  const { data: deleted, error } = await supabase
    .from("team_invitations")
    .delete()
    .eq("id", body.invitationId)
    .select("id");
  if (error || !deleted || deleted.length === 0) {
    return NextResponse.json({ error: "No se pudo borrar la invitación" }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
