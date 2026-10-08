import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { STATUSES } from "@/lib/asistencia";

// POST /api/asistencia
// json: { eventId, records: [{ playerId, status }] }
// Guarda (o corrige) la asistencia de un evento. Solo coach/assistant del equipo del evento.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.eventId !== "string" || !Array.isArray(body.records)) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }
  if (body.records.length === 0 || body.records.length > 200) {
    return NextResponse.json({ error: "Marca la asistencia de al menos un jugador" }, { status: 400 });
  }

  const records: { playerId: string; status: string }[] = [];
  for (const r of body.records) {
    if (!r || typeof r.playerId !== "string" || !(STATUSES as readonly string[]).includes(r.status)) {
      return NextResponse.json({ error: "Datos de asistencia inválidos" }, { status: 400 });
    }
    records.push({ playerId: r.playerId, status: r.status });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 });
  }
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Tenés que iniciar sesión" }, { status: 401 });
  }

  const { data: event } = await supabase.from("events").select("id, team_id").eq("id", body.eventId).single();
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }

  const { data: membership } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", event.team_id)
    .eq("profile_id", userData.user.id)
    .maybeSingle();
  if (!membership || (membership.role !== "coach" && membership.role !== "assistant")) {
    return NextResponse.json({ error: "No tenés permiso para tomar asistencia en este equipo" }, { status: 403 });
  }

  if (!isAdminConfigured) {
    return NextResponse.json({ error: "Falta configurar el servidor" }, { status: 500 });
  }
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Falta configurar el servidor" }, { status: 500 });
  }

  // Los jugadores tienen que ser de ESTE equipo.
  const ids = Array.from(new Set(records.map((r) => r.playerId)));
  const { data: valid } = await admin.from("players").select("id").eq("team_id", event.team_id).in("id", ids);
  const validIds = new Set((valid ?? []).map((p: any) => p.id as string));
  if (ids.some((id) => !validIds.has(id))) {
    return NextResponse.json({ error: "Hay jugadores que no son de este equipo" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const rows = ids.map((id) => ({
    event_id: event.id,
    player_id: id,
    status: records.find((r) => r.playerId === id)!.status,
    recorded_by: userData.user!.id,
    updated_at: now,
  }));
  const { error } = await admin.from("event_attendance").upsert(rows, { onConflict: "event_id,player_id" });
  if (error) {
    return NextResponse.json({ error: "No se pudo guardar la asistencia" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, guardados: rows.length });
}
