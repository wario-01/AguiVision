import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isFormation, cleanLineup, cleanSubs } from "@/lib/lineup";

// POST /api/alineacion
// json: { teamSlug, eventId (o null), formation, slots, out, notes }
// Guarda la alineación de un partido. Solo coach/assistant del equipo.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.teamSlug !== "string" || !isFormation(body.formation)) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 });
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Tenés que iniciar sesión" }, { status: 401 });

  const { data: team } = await supabase.from("teams").select("id").eq("slug", body.teamSlug).maybeSingle();
  if (!team) return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
  const { data: membership } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", team.id)
    .eq("profile_id", userData.user.id)
    .maybeSingle();
  if (!membership || (membership.role !== "coach" && membership.role !== "assistant")) {
    return NextResponse.json({ error: "No tenés permiso para editar alineaciones de este equipo" }, { status: 403 });
  }

  let eventId: string | null = null;
  if (typeof body.eventId === "string" && body.eventId) {
    const { data: ev } = await supabase.from("events").select("id, team_id, type").eq("id", body.eventId).maybeSingle();
    if (!ev || ev.team_id !== team.id || ev.type !== "game") {
      return NextResponse.json({ error: "Partido no encontrado en este equipo" }, { status: 404 });
    }
    eventId = ev.id;
  }

  const admin = isAdminConfigured ? createAdminClient() : null;
  if (!admin) return NextResponse.json({ error: "Falta configurar el servidor" }, { status: 500 });

  const { data: pl } = await admin.from("players").select("id").eq("team_id", team.id);
  const valid = new Set((pl ?? []).map((p: any) => p.id as string));
  const { slots, out } = cleanLineup(body.formation, body.slots, body.out, valid);
  const subs = cleanSubs(body.subs, slots, out, valid);
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 1000) : null;

  const row = { formation: body.formation, slots, out_ids: out, notes, updated_at: new Date().toISOString() };
  const find = admin.from("lineups").select("id").eq("team_id", team.id);
  const { data: existing, error: e1 } = await (eventId ? find.eq("event_id", eventId) : find.is("event_id", null)).maybeSingle();
  if (e1) {
    return NextResponse.json(
      { error: "Falta correr el SQL de alineaciones en Supabase (alineaciones-estadisticas.sql)." },
      { status: 500 }
    );
  }
  const write = (r: Record<string, unknown>) =>
    existing
      ? admin.from("lineups").update(r).eq("id", existing.id)
      : admin.from("lineups").insert({ ...r, team_id: team.id, event_id: eventId });
  let { error } = await write({ ...row, subs });
  // Si todavía no existe la columna "subs" (SQL sin correr), se guarda sin cambios planeados.
  if (error && /subs/.test(error.message ?? "")) {
    if (subs.length > 0) {
      return NextResponse.json(
        { error: "Falta correr el SQL de cambios planeados en Supabase (alineaciones-cambios.sql)." },
        { status: 500 }
      );
    }
    ({ error } = await write(row));
  }
  if (error) return NextResponse.json({ error: "No se pudo guardar la alineación" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
