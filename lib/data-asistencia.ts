// lib/data-asistencia.ts
//
// Lecturas de asistencia. Usa el cliente normal: la base de datos solo deja leer
// a entrenador/asistente del equipo y al papá/jugador vinculado a ese jugador.

import { createClient } from "@/lib/supabase/server";
import { AttRecord, AttStatus, monthOf } from "@/lib/asistencia";
import type { CalendarEvent } from "@/lib/data";

const PAGE = 1000; // Supabase devuelve máximo 1000 filas por consulta

async function fetchAll(make: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>) {
  const out: any[] = [];
  for (let i = 0; i < 50; i++) {
    const { data, error } = await make(i * PAGE, (i + 1) * PAGE - 1);
    if (error || !data) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

function yearBounds(year: number) {
  // Margen de un día: el recorte exacto por hora de Austin se hace después, en código.
  return {
    from: new Date(Date.UTC(year, 0, 1) - 86400000).toISOString(),
    to: new Date(Date.UTC(year + 1, 0, 1) + 86400000).toISOString(),
  };
}

const SELECT = "event_id, player_id, status, events!inner(team_id, type, start_at, title, opponent)";

function toRecord(r: any): AttRecord {
  return {
    event_id: r.event_id,
    player_id: r.player_id,
    status: r.status as AttStatus,
    event_type: r.events.type,
    start_at: r.events.start_at,
    title: r.events.title,
    opponent: r.events.opponent,
  };
}

// Toda la asistencia de un equipo en un año.
export async function getTeamAttendance(teamId: string, year: number): Promise<AttRecord[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { from, to } = yearBounds(year);
  const rows = await fetchAll((a, b) =>
    supabase
      .from("event_attendance")
      .select(SELECT)
      .eq("events.team_id", teamId)
      .gte("events.start_at", from)
      .lt("events.start_at", to)
      .order("event_id")
      .order("player_id")
      .range(a, b)
  );
  return rows.map(toRecord).filter((r) => monthOf(r.start_at).year === year);
}

// Asistencia de UN jugador en un año.
export async function getPlayerAttendance(playerId: string, year: number): Promise<AttRecord[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { from, to } = yearBounds(year);
  const rows = await fetchAll((a, b) =>
    supabase
      .from("event_attendance")
      .select(SELECT)
      .eq("player_id", playerId)
      .gte("events.start_at", from)
      .lt("events.start_at", to)
      .order("event_id")
      .range(a, b)
  );
  return rows
    .map(toRecord)
    .filter((r) => monthOf(r.start_at).year === year)
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
}

// Estado ya guardado de cada jugador en un evento.
export async function getEventAttendance(eventId: string): Promise<Record<string, AttStatus>> {
  const supabase = await createClient();
  if (!supabase) return {};
  const { data } = await supabase.from("event_attendance").select("player_id, status").eq("event_id", eventId);
  const out: Record<string, AttStatus> = {};
  for (const r of (data ?? []) as any[]) out[r.player_id] = r.status;
  return out;
}

// Cuáles de estos eventos ya tienen asistencia tomada.
export async function getEventsWithAttendance(eventIds: string[]): Promise<Set<string>> {
  if (eventIds.length === 0) return new Set();
  const supabase = await createClient();
  if (!supabase) return new Set();
  const rows = await fetchAll((a, b) =>
    supabase.from("event_attendance").select("event_id").in("event_id", eventIds).order("event_id").range(a, b)
  );
  return new Set(rows.map((r) => r.event_id as string));
}

// Eventos de los últimos 45 días que ya pasaron y todavía no tienen asistencia.
export async function getPendingEvents(teamId: string): Promise<CalendarEvent[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const now = new Date();
  const since = new Date(now.getTime() - 45 * 86400000);
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("team_id", teamId)
    .in("type", ["practice", "game", "tournament"])
    .gte("start_at", since.toISOString())
    .lte("start_at", now.toISOString())
    .order("start_at", { ascending: false });
  const events = (data ?? []) as CalendarEvent[];
  const done = await getEventsWithAttendance(events.map((e) => e.id));
  return events.filter((e) => !done.has(e.id));
}
