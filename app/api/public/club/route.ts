import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/public/club
// Datos PÚBLICOS para el sitio web del club (NidoAustin.com):
//   - live:     transmisiones que están en vivo ahora (para el aviso "EN VIVO")
//   - upcoming: próximos partidos y torneos del calendario
//
// Solo devuelve campos que ya son públicos o no identifican a nadie:
// categoría, rival, liga, cancha, hora y el link a /en-vivo/<id> (que ya es
// una página pública). NUNCA devuelve notas, entrenamientos, jugadores,
// highlights ni datos de familias.
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
    return NextResponse.json({ live: [], upcoming: [] }, { headers: { ...CORS, ...CACHE } });
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

  return NextResponse.json({ live, upcoming }, { headers: { ...CORS, ...CACHE } });
}
