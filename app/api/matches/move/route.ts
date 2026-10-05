import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

// POST /api/matches/move
// json: { matchId, targetTeamId }
// Mueve un partido (con su video y su transmisión) a otro equipo. Hay que ser
// entrenador/asistente tanto del equipo actual como del equipo destino.
// Los highlights se quedan con el video, pero pierden la asignación de
// jugador (esos jugadores pertenecen al equipo anterior).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.matchId !== "string" || typeof body.targetTeamId !== "string") {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }
  const { matchId, targetTeamId } = body;

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 });
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Tenés que iniciar sesión" }, { status: 401 });
  }

  const { data: match } = await supabase.from("matches").select("id, team_id").eq("id", matchId).single();
  if (!match) {
    return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
  }
  if (match.team_id === targetTeamId) {
    return NextResponse.json({ error: "El partido ya está en ese equipo" }, { status: 400 });
  }

  const { data: memberships } = await supabase
    .from("team_members")
    .select("team_id, role")
    .eq("profile_id", userData.user.id)
    .in("team_id", [match.team_id, targetTeamId]);

  const canManage = (teamId: string) =>
    (memberships ?? []).some((m) => m.team_id === teamId && (m.role === "coach" || m.role === "assistant"));

  if (!canManage(match.team_id) || !canManage(targetTeamId)) {
    return NextResponse.json(
      { error: "Tenés que ser entrenador o asistente de los dos equipos para mover un video" },
      { status: 403 }
    );
  }

  if (!isAdminConfigured) {
    return NextResponse.json({ error: "Falta configurar el servidor" }, { status: 500 });
  }
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Falta configurar el servidor" }, { status: 500 });
  }

  const { data: target } = await admin.from("teams").select("id, slug").eq("id", targetTeamId).single();
  if (!target) {
    return NextResponse.json({ error: "Equipo destino no encontrado" }, { status: 404 });
  }

  // Los highlights apuntan a jugadores del equipo viejo — se desvinculan.
  const { error: hlError } = await admin.from("highlights").update({ player_id: null }).eq("match_id", match.id);
  if (hlError) {
    return NextResponse.json({ error: "No se pudo mover el video" }, { status: 500 });
  }

  const { error: matchError } = await admin.from("matches").update({ team_id: targetTeamId }).eq("id", match.id);
  if (matchError) {
    return NextResponse.json({ error: "No se pudo mover el video" }, { status: 500 });
  }

  // La transmisión asociada (si la hay) también pasa al equipo correcto.
  await admin.from("live_streams").update({ team_id: targetTeamId }).eq("match_id", match.id);

  return NextResponse.json({ ok: true, targetSlug: target.slug });
}
