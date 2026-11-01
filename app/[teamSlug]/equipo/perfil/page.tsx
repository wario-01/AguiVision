// app/[teamSlug]/equipo/perfil/page.tsx
//
// Perfil del equipo (solo entrenadores): resumen, campograma con alineación,
// estadísticas del partido y estadísticas de la temporada por jugador.

import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import LineupWorkspace, { GameOption, StatRow, ResultRow } from "@/components/LineupWorkspace";
import { getTeamBySlug, getPlayers } from "@/lib/data";
import { getTeamAttendance } from "@/lib/data-asistencia";
import { countRecords } from "@/lib/asistencia";
import { createClient } from "@/lib/supabase/server";
import { clubParts, clubTime } from "@/lib/tz";
import { defaultFormation, isFormation, cleanLineup, cleanSubs } from "@/lib/lineup";

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const sum = (xs: (number | null | undefined)[]) => xs.reduce<number>((s, v) => s + (v ?? 0), 0);

const TeamTabs = ({ slug, active }: { slug: string; active: "perfil" | "plantilla" }) => (
  <div className="flex gap-2 mb-6 flex-wrap">
    <Link
      href={`/${slug}/equipo/perfil`}
      className={`rounded-full px-4 py-2 text-xs font-extrabold border ${
        active === "perfil" ? "bg-gold text-bg border-gold" : "bg-panel border-border text-muted"
      }`}
    >
      Perfil del equipo
    </Link>
    <Link
      href={`/${slug}/equipo`}
      className={`rounded-full px-4 py-2 text-xs font-extrabold border ${
        active === "plantilla" ? "bg-gold text-bg border-gold" : "bg-panel border-border text-muted"
      }`}
    >
      Plantilla, miembros e invitaciones
    </Link>
  </div>
);

export default async function PerfilEquipoPage({
  params,
  searchParams,
}: {
  params: { teamSlug: string };
  searchParams: { e?: string };
}) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();
  if (team.role !== "coach" && team.role !== "assistant") notFound();

  const supabase = await createClient();
  if (!supabase) notFound();

  const players = (await getPlayers(team.slug)).sort(
    (a, b) => (a.jersey_number ?? 999) - (b.jersey_number ?? 999) || a.full_name.localeCompare(b.full_name)
  );
  const ids = players.map((p) => p.id);
  const year = clubParts(new Date()).year;
  const yearStart = new Date(Date.UTC(year, 0, 1)).toISOString();

  // Partidos: los últimos 60 días y todos los que vienen (sin cancelados).
  const since = new Date(Date.now() - 60 * 86400000).toISOString();
  const { data: evs } = await supabase
    .from("events")
    .select("*")
    .eq("team_id", team.id)
    .eq("type", "game")
    .gte("start_at", since)
    .order("start_at", { ascending: true });
  let gameRows = ((evs ?? []) as any[]).filter((e) => !e.cancelled);
  // Si piden un partido más viejo, también se incluye.
  if (searchParams.e && !gameRows.some((g) => g.id === searchParams.e)) {
    const { data: one } = await supabase.from("events").select("*").eq("id", searchParams.e).eq("team_id", team.id).eq("type", "game").maybeSingle();
    if (one) gameRows = [one, ...gameRows];
  }
  const mkGame = (g: any): GameOption => {
    const p = clubParts(g.start_at);
    const when = `${DIAS[p.dow]} ${p.day} ${MESES[p.month]}`;
    return {
      id: g.id,
      startAt: g.start_at,
      label: `${when} · vs ${g.opponent ?? "?"}`,
      title: `vs ${g.opponent ?? "?"}`,
      details: `${when} · ${clubTime(g.start_at)}${g.location ? ` · ${g.location}` : ""}`,
    };
  };
  const games = gameRows.map(mkGame);
  const eventId = searchParams.e && games.some((g) => g.id === searchParams.e) ? searchParams.e : null;

  // Alineación guardada para ese partido (o el borrador sin partido).
  const lineupBase = supabase.from("lineups").select("*").eq("team_id", team.id);
  const { data: lineupRow, error: lineupErr } = await (eventId
    ? lineupBase.eq("event_id", eventId)
    : lineupBase.is("event_id", null)
  ).maybeSingle();
  const missingSql = !!lineupErr;
  const formation = isFormation((lineupRow as any)?.formation) ? (lineupRow as any).formation : defaultFormation(team.age_category);
  const cl = cleanLineup(formation, (lineupRow as any)?.slots, (lineupRow as any)?.out_ids, new Set(ids));
  const subsInit = cleanSubs((lineupRow as any)?.subs, cl.slots, cl.out, new Set(ids));

  // Estadísticas de ese partido.
  let statsInit: Record<string, StatRow> = {};
  let resultInit: ResultRow | null = null;
  if (eventId && !missingSql) {
    const [{ data: st }, { data: rs }] = await Promise.all([
      supabase.from("game_stats").select("*").eq("event_id", eventId),
      supabase.from("game_results").select("*").eq("event_id", eventId).maybeSingle(),
    ]);
    for (const r of (st ?? []) as any[]) statsInit[r.player_id] = r;
    resultInit = (rs as any) ?? null;
  }

  // Temporada: asistencia, estadísticas y resultados del año.
  const att = await getTeamAttendance(team.id, year);
  const attByPlayer = new Map<string, typeof att>();
  for (const r of att) {
    if (!attByPlayer.has(r.player_id)) attByPlayer.set(r.player_id, []);
    attByPlayer.get(r.player_id)!.push(r);
  }
  const teamPct = countRecords(att).pct;

  let seasonStats: any[] = [];
  let seasonResults: any[] = [];
  if (!missingSql) {
    if (ids.length > 0) {
      const { data } = await supabase.from("game_stats").select("*, events!inner(start_at)").in("player_id", ids).gte("events.start_at", yearStart);
      seasonStats = data ?? [];
    }
    const { data: rs } = await supabase
      .from("game_results")
      .select("*, events!inner(team_id, start_at)")
      .eq("events.team_id", team.id)
      .gte("events.start_at", yearStart);
    seasonResults = rs ?? [];
  }
  const played = seasonResults.filter((r) => r.goals_for != null && r.goals_against != null);
  const wins = played.filter((r) => r.goals_for > r.goals_against).length;
  const draws = played.filter((r) => r.goals_for === r.goals_against).length;
  const losses = played.length - wins - draws;
  const gf = sum(played.map((r) => r.goals_for));
  const ga = sum(played.map((r) => r.goals_against));

  const kpi = (value: string, label: string, color = "") => (
    <div className="bg-panel border border-border rounded-2xl px-4 py-3">
      <div className={`font-display text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-[11px] font-bold text-muted mt-0.5">{label}</div>
    </div>
  );

  const before = (
    <>
      <div className="font-display text-2xl font-bold mb-1">Equipo</div>
      <div className="text-sm text-muted mb-5">{team.name}</div>
      <TeamTabs slug={team.slug} active="perfil" />
      {missingSql && (
        <div className="rounded-xl border border-red bg-panel px-4 py-3 mb-5 text-sm">
          Falta correr el SQL de alineaciones en Supabase (<b>alineaciones-estadisticas.sql</b>) para poder guardar y ver las estadísticas.
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {kpi(String(players.length), "Jugadores")}
        {kpi(teamPct == null ? "—" : `${teamPct}%`, "Asistencia general", teamPct != null && teamPct >= 90 ? "text-ok" : "")}
        {kpi(played.length ? `${wins}-${draws}-${losses}` : "—", "Ganados-empatados-perdidos", "text-goldText")}
        {kpi(played.length ? String(gf) : "—", "Goles a favor")}
        {kpi(played.length ? String(ga) : "—", "Goles en contra")}
      </div>
    </>
  );

  const th = "text-[10px] uppercase tracking-wide text-muted font-bold py-2 px-2 text-center";
  const after = (
    <div className="bg-panel border border-border rounded-2xl p-5 mb-8">
      <div className="font-display text-lg font-semibold mb-1">Estadísticas de la temporada {year}</div>
      <div className="text-xs text-muted mb-4">
        Se llenan con los datos que guardas de cada partido. Toca un jugador para abrir su perfil.
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[640px]">
          <thead>
            <tr>
              <th className={`${th} text-left`}>Jugador</th>
              <th className={th}>Pos.</th>
              <th className={th}>Asist. %</th>
              <th className={th}>PJ</th>
              <th className={th}>Min.</th>
              <th className={th}>Goles</th>
              <th className={th}>Asist.</th>
              <th className={th}>Amar.</th>
              <th className={th}>Roja</th>
              <th className={th}>Atajadas</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => {
              const mine = seasonStats.filter((s) => s.player_id === p.id);
              const pct = countRecords(attByPlayer.get(p.id) ?? []).pct;
              const cell = "py-2 px-2 text-center font-bold";
              return (
                <tr key={p.id} className="border-t border-border">
                  <td className="py-2 px-2 font-bold whitespace-nowrap">
                    <span className="text-gold">{p.jersey_number != null ? `#${p.jersey_number} ` : ""}</span>
                    <Link href={`/${team.slug}/jugador/${p.id}`} className="hover:underline">
                      {p.full_name}
                    </Link>
                  </td>
                  <td className={`${cell} text-muted`}>{p.position ?? "—"}</td>
                  <td className={`${cell} ${pct == null ? "text-muted" : pct >= 90 ? "text-ok" : pct < 75 ? "text-red" : ""}`}>
                    {pct == null ? "—" : `${pct}%`}
                  </td>
                  <td className={cell}>{mine.length || "—"}</td>
                  <td className={cell}>{mine.length ? sum(mine.map((s) => s.minutes)) : "—"}</td>
                  <td className={cell}>{mine.length ? sum(mine.map((s) => s.goals)) : "—"}</td>
                  <td className={cell}>{mine.length ? sum(mine.map((s) => s.assists)) : "—"}</td>
                  <td className={cell}>{mine.length ? sum(mine.map((s) => s.yellow)) : "—"}</td>
                  <td className={cell}>{mine.length ? sum(mine.map((s) => s.red)) : "—"}</td>
                  <td className={cell}>{mine.length ? sum(mine.map((s) => s.saves)) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="print-root flex h-screen w-full">
      <div className="no-print">
        <Sidebar currentTeamSlug={team.slug} active="equipo" />
      </div>
      <LineupWorkspace
        key={eventId ?? "none"}
        teamSlug={team.slug}
        teamName={team.name}
        ageCategory={team.age_category}
        players={players.map((p) => ({ id: p.id, full_name: p.full_name, jersey_number: p.jersey_number ?? null, position: p.position ?? null }))}
        games={games}
        eventId={eventId}
        initial={{ formation, slots: cl.slots, out: cl.out, subs: subsInit, notes: (lineupRow as any)?.notes ?? "" }}
        statsInit={statsInit}
        resultInit={resultInit}
        before={before}
        after={after}
      />
    </div>
  );
}
