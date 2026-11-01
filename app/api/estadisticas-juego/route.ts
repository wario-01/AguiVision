import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

// POST /api/estadisticas-juego
// json: { eventId, result: { goals_for, goals_against, shots, corners, fouls, subs },
//         players: [{ playerId, minutes, goals, assists, yellow, red, saves }] }
// Los campos vacíos son null. Solo coach/assistant del equipo del partido.
const num = (v: unknown, max: number): number | null | undefined => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > max) return undefined; // inválido
  return n;
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.eventId !== "string" || !Array.isArray(body.players) || body.players.length > 100) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const r = body.result ?? {};
  const result = {
    goals_for: num(r.goals_for, 99),
    goals_against: num(r.goals_against, 99),
    shots: num(r.shots, 200),
    corners: num(r.corners, 100),
    fouls: num(r.fouls, 100),
    subs: num(r.subs, 50),
  };
  if (Object.values(result).some((v) => v === undefined)) {
    return NextResponse.json({ error: "Hay números inválidos en el resultado del equipo" }, { status: 400 });
  }

  const rows: any[] = [];
  const blank: string[] = [];
  for (const p of body.players) {
    if (!p || typeof p.playerId !== "string") return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    const f = {
      minutes: num(p.minutes, 200),
      goals: num(p.goals, 30),
      assists: num(p.assists, 30),
      yellow: num(p.yellow, 5),
      red: num(p.red, 5),
      saves: num(p.saves, 100),
    };
    if (Object.values(f).some((v) => v === undefined)) {
      return NextResponse.json({ error: "Hay números inválidos en las estadísticas de los jugadores" }, { status: 400 });
    }
    if (Object.values(f).every((v) => v === null)) blank.push(p.playerId);
    else rows.push({ player_id: p.playerId, ...f });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 });
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Tenés que iniciar sesión" }, { status: 401 });

  const { data: event } = await supabase.from("events").select("id, team_id, type").eq("id", body.eventId).maybeSingle();
  if (!event || event.type !== "game") return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
  const { data: membership } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", event.team_id)
    .eq("profile_id", userData.user.id)
    .maybeSingle();
  if (!membership || (membership.role !== "coach" && membership.role !== "assistant")) {
    return NextResponse.json({ error: "No tenés permiso para guardar estadísticas de este equipo" }, { status: 403 });
  }

  const admin = isAdminConfigured ? createAdminClient() : null;
  if (!admin) return NextResponse.json({ error: "Falta configurar el servidor" }, { status: 500 });

  const ids = Array.from(new Set([...rows.map((x) => x.player_id), ...blank]));
  const { data: valid } = await admin.from("players").select("id").eq("team_id", event.team_id).in("id", ids);
  const validIds = new Set((valid ?? []).map((p: any) => p.id as string));
  if (ids.some((id) => !validIds.has(id))) {
    return NextResponse.json({ error: "Hay jugadores que no son de este equipo" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const missing = (e: any) => /game_stats|game_results|relation|does not exist/i.test(e?.message ?? "");
  const sqlMsg = "Falta correr el SQL de estadísticas en Supabase (alineaciones-estadisticas.sql).";

  if (rows.length > 0) {
    const { error } = await admin
      .from("game_stats")
      .upsert(rows.map((x) => ({ ...x, event_id: event.id, updated_at: now })), { onConflict: "event_id,player_id" });
    if (error) return NextResponse.json({ error: missing(error) ? sqlMsg : "No se pudieron guardar las estadísticas" }, { status: 500 });
  }
  if (blank.length > 0) {
    await admin.from("game_stats").delete().eq("event_id", event.id).in("player_id", blank);
  }

  if (Object.values(result).every((v) => v === null)) {
    await admin.from("game_results").delete().eq("event_id", event.id);
  } else {
    const { error } = await admin.from("game_results").upsert({ event_id: event.id, ...result, updated_at: now }, { onConflict: "event_id" });
    if (error) return NextResponse.json({ error: missing(error) ? sqlMsg : "No se pudo guardar el resultado" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
