import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clubParts } from "@/lib/tz";

// GET /api/public/club
// Datos PÚBLICOS para el sitio web del club (NidoAustin.com):
//   - live:     transmisiones que están en vivo ahora (para el aviso "EN VIVO")
//   - upcoming: próximos partidos y torneos del calendario
//   - results:  últimos marcadores capturados en el año (solo del equipo)
//   - records:  récord del año por categoría (G-E-P, goles a favor/en contra)
//
// Solo devuelve campos que ya son públicos o no identifican a nadie:
// categoría, rival, liga, cancha, hora y el link a /en-vivo/<id> (que ya es
// una página pública). NUNCA devuelve notas, entrenamientos, jugadores,
// highlights, estadísticas individuales ni datos de familias.
//
// La respuesta se guarda 60 s en la CDN de Vercel, así que aunque muchas
// personas abran el sitio a la vez, la base de datos se consulta como
// máximo una vez por minuto.

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*", // datos públicos y de solo lectura
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const CACHE = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" };

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: Request) {
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ live: [], upcoming: [], results: [], records: [] }, { headers: { ...CORS, ...CACHE } });
  }

  const origin = new URL(req.url).origin;
  // Mostrar también un partido que empezó hace menos de 2 h (sigue "hoy").
  const from = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const [liveRes, eventsRes] = await Promise.all([
    admin
      .from("live_streams")
      .select("id, title, started_at, teams!inner(age_category, active)")
      .eq("status", "live")
      .eq("teams.active", true)
      .order("started_at", { ascending: false })
      .limit(6),
    admin
      .from("events")
      .select("id, type, title, opponent, opponent_logo_url, league, location, start_at, end_at, cancelled, teams!inner(age_category, active)")
      .in("type", ["game", "tournament"])
      .eq("teams.active", true)
      .gte("start_at", from)
      .order("start_at", { ascending: true })
      .limit(8),
  ]);

  // Si todavía no existe la columna "cancelled" (SQL sin correr), se pide sin ella.
  let eventRows: any[] = eventsRes.data ?? [];
  if (eventsRes.error) {
    const retry = await admin
      .from("events")
      .select("id, type, title, opponent, opponent_logo_url, league, location, start_at, end_at, teams!inner(age_category, active)")
      .in("type", ["game", "tournament"])
      .eq("teams.active", true)
      .gte("start_at", from)
      .order("start_at", { ascending: true })
      .limit(8);
    eventRows = retry.data ?? [];
  }

  const live = (liveRes.data ?? []).map((s: any) => ({
    id: s.id,
    category: s.teams?.age_category ?? null,
    title: s.title,
    started_at: s.started_at,
    watch_url: `${origin}/en-vivo/${s.id}`,
  }));

  const upcoming = eventRows.filter((e: any) => !e.cancelled).map((e: any) => ({
    id: e.id,
    type: e.type,
    category: e.teams?.age_category ?? null,
    title: e.title,
    opponent: e.opponent,
    opponent_logo_url: e.opponent_logo_url,
    league: e.league,
    location: e.location,
    start_at: e.start_at,
    end_at: e.end_at,
  }));

  // ---- Resultados del año (mismo criterio que el Perfil del equipo: año calendario del club).
  // Solo marcador del EQUIPO; game_stats (jugadores) nunca se lee aquí.
  const year = clubParts(new Date()).year;
  const yearStart = new Date(Date.UTC(year, 0, 1)).toISOString();
  const { data: resRows } = await admin
    .from("game_results")
    .select("goals_for, goals_against, events!inner(id, type, title, opponent, opponent_logo_url, league, start_at, teams!inner(age_category, active))")
    .gte("events.start_at", yearStart)
    .eq("events.teams.active", true);

  const played = (resRows ?? [])
    .filter((r: any) => r.goals_for != null && r.goals_against != null && r.events)
    .map((r: any) => ({
      id: r.events.id,
      category: r.events.teams?.age_category ?? null,
      opponent: r.events.opponent,
      opponent_logo_url: r.events.opponent_logo_url,
      title: r.events.title,
      league: r.events.league,
      start_at: r.events.start_at,
      goals_for: r.goals_for as number,
      goals_against: r.goals_against as number,
      outcome: r.goals_for > r.goals_against ? "W" : r.goals_for < r.goals_against ? "L" : "D",
    }))
    .sort((a: any, b: any) => (a.start_at < b.start_at ? 1 : -1));

  const results = played.slice(0, 12);

  const byCat = new Map<string, { category: string; played: number; wins: number; draws: number; losses: number; goals_for: number; goals_against: number }>();
  for (const g of played) {
    if (!g.category) continue;
    const r = byCat.get(g.category) ?? { category: g.category, played: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0 };
    r.played++;
    if (g.outcome === "W") r.wins++; else if (g.outcome === "L") r.losses++; else r.draws++;
    r.goals_for += g.goals_for;
    r.goals_against += g.goals_against;
    byCat.set(g.category, r);
  }
  const records = Array.from(byCat.values()).map((r) => ({ ...r, year }));

  return NextResponse.json({ live, upcoming, results, records }, { headers: { ...CORS, ...CACHE } });
}
