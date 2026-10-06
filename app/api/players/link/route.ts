import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

// POST /api/players/link
// json: { playerId, otherPlayerId }        → vincula: son el mismo niño
// json: { playerId, unlink: true }         → desvincula a este registro
// Vincular exige ser entrenador/asistente de los DOS equipos.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.playerId !== "string") {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }
  const unlink = body.unlink === true;
  if (!unlink && typeof body.otherPlayerId !== "string") {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }
  if (!unlink && body.otherPlayerId === body.playerId) {
    return NextResponse.json({ error: "Elige a otro jugador" }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 });
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Tenés que iniciar sesión" }, { status: 401 });
  }

  const ids = unlink ? [body.playerId] : [body.playerId, body.otherPlayerId];
  const { data: players } = await supabase.from("players").select("id, team_id, person_id").in("id", ids);
  const mine = players?.find((p) => p.id === body.playerId);
  const other = unlink ? null : players?.find((p) => p.id === body.otherPlayerId);
  if (!mine || (!unlink && !other)) {
    return NextResponse.json({ error: "Jugador no encontrado" }, { status: 404 });
  }

  const teamIds = Array.from(new Set([mine.team_id, ...(other ? [other.team_id] : [])]));
  const { data: memberships } = await supabase
    .from("team_members")
    .select("team_id, role")
    .eq("profile_id", userData.user.id)
    .in("team_id", teamIds);

  const isStaffOf = (teamId: string) =>
    (memberships ?? []).some((m) => m.team_id === teamId && (m.role === "coach" || m.role === "assistant"));

  if (!teamIds.every(isStaffOf)) {
    return NextResponse.json(
      { error: "Tenés que ser entrenador o asistente de los dos equipos para vincular a un jugador" },
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

  const newPersonId = unlink ? randomUUID() : other!.person_id;
  const { error } = await admin.from("players").update({ person_id: newPersonId }).eq("id", mine.id);
  if (error) {
    return NextResponse.json({ error: "No se pudo guardar el vínculo" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
