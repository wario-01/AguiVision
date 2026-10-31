import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import NewEventToggle from "@/components/NewEventToggle";
import EventDeleteButton from "@/components/EventDeleteButton";
import { getTeamBySlug, getEvents, getMyTeams, getTournamentGames } from "@/lib/data";
import { getEventsWithAttendance } from "@/lib/data-asistencia";
import { clubParts, clubTime } from "@/lib/tz";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const TYPE_LABELS: Record<string, string> = {
  game: "Partido",
  practice: "Entrenamiento",
  tournament: "Torneo",
  other: "Evento",
};

// Se pide un día de más por cada lado y después se filtra por el mes en hora
// de Texas, para no perder eventos de la noche del último día del mes.
function monthRange(year: number, month: number) {
  const from = new Date(Date.UTC(year, month, 1) - 24 * 3600 * 1000).toISOString();
  const to = new Date(Date.UTC(year, month + 1, 1) + 24 * 3600 * 1000).toISOString();
  return { from, to };
}

export default async function CalendarioPage({
  params,
  searchParams,
}: {
  params: { teamSlug: string };
  searchParams: { m?: string };
}) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();

  const canEdit = team.role === "coach" || team.role === "assistant";
  const managedTeams = canEdit
    ? (await getMyTeams())
        .filter((t) => t.role === "coach" || t.role === "assistant")
        .map((t) => ({ slug: t.slug, name: t.name }))
    : [];

  const nowParts = clubParts(new Date());
  const [y, m] = (searchParams.m ?? `${nowParts.year}-${nowParts.month}`).split("-").map(Number);
  const range = monthRange(y, m);
  const monthEvents = (await getEvents(team.slug, range)).filter((ev) => {
    const p = clubParts(ev.start_at);
    return p.year === y && p.month === m;
  });
  // Los juegos de un torneo se muestran dentro del torneo (aunque caigan en otro mes).
  const tournamentGames = await getTournamentGames(monthEvents.filter((e) => e.type === "tournament").map((e) => e.id));
  const gamesByTournament = new Map<string, typeof tournamentGames>();
  for (const g of tournamentGames) {
    const k = g.parent_event_id as string;
    if (!gamesByTournament.has(k)) gamesByTournament.set(k, []);
    gamesByTournament.get(k)!.push(g);
  }
  const events = monthEvents.filter((ev) => !ev.parent_event_id);
  const withAttendance = canEdit
    ? await getEventsWithAttendance([...events, ...tournamentGames].map((e) => e.id))
    : new Set<string>();

  const prevM = m === 0 ? 11 : m - 1;
  const prevY = m === 0 ? y - 1 : y;
  const nextM = m === 11 ? 0 : m + 1;
  const nextY = m === 11 ? y + 1 : y;

  // Agrupar por día
  const byDay = new Map<string, typeof events>();
  for (const ev of events) {
    const key = clubParts(ev.start_at).ymd;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(ev);
  }
  const days = Array.from(byDay.keys()).sort();

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="calendario" />
      <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11 max-w-2xl">
        <div className="font-display text-2xl font-bold mb-1">Calendario</div>
        <div className="text-sm text-muted mb-6">{team.name}</div>

        <div className="flex items-center justify-between mb-6">
          <Link
            href={`/${team.slug}/calendario?m=${prevY}-${prevM}`}
            className="text-sm font-bold text-muted px-3 py-2"
          >
            ‹ Anterior
          </Link>
          <div className="font-display text-lg font-semibold">
            {MESES[m]} {y}
          </div>
          <Link
            href={`/${team.slug}/calendario?m=${nextY}-${nextM}`}
            className="text-sm font-bold text-muted px-3 py-2"
          >
            Siguiente ›
          </Link>
        </div>

        {canEdit && (
          <div className="mb-4">
            <Link href={`/${team.slug}/asistencia`} className="text-xs font-bold text-gold hover:underline">
              Ver reporte de asistencia →
            </Link>
          </div>
        )}

        {canEdit && <NewEventToggle teamSlug={team.slug} teams={managedTeams} />}

        {days.length === 0 && (
          <div className="text-sm text-muted border border-dashed border-borderMuted rounded-2xl p-8 text-center">
            No hay eventos cargados para {MESES[m].toLowerCase()}.
          </div>
        )}

        <div className="flex flex-col gap-5">
          {days.map((day) => {
            const d = new Date(day + "T00:00:00");
            return (
              <div key={day}>
                <div className="text-xs font-bold text-gold uppercase tracking-wide mb-2">
                  {DIAS[d.getDay()]} {d.getDate()} de {MESES[m].toLowerCase()}
                </div>
                <div className="flex flex-col gap-2">
                  {byDay.get(day)!.map((ev) => {
                    if (ev.type === "tournament") {
                      const games = gamesByTournament.get(ev.id) ?? [];
                      const sp = clubParts(ev.start_at);
                      const ep = ev.end_at ? clubParts(ev.end_at) : null;
                      const range =
                        ep && ep.ymd !== sp.ymd
                          ? `${sp.day} ${MESES[sp.month].slice(0, 3)} – ${ep.day} ${MESES[ep.month].slice(0, 3)}`
                          : null;
                      return (
                        <div key={ev.id} className={`bg-panel border border-border rounded-xl overflow-hidden ${ev.cancelled ? "opacity-70" : ""}`}>
                          <div className="flex items-center gap-3 px-4 py-3">
                            <Link href={`/${team.slug}/calendario/evento/${ev.id}`} className="flex-grow min-w-0 block">
                              <div className="text-[10px] font-extrabold uppercase tracking-widest text-gold">
                                Torneo{ev.cancelled && <span className="text-red"> · CANCELADO</span>}
                              </div>
                              <div className={`text-sm font-bold truncate ${ev.cancelled ? "line-through" : ""}`}>{ev.title || "Torneo"}</div>
                              <div className="text-xs text-muted truncate">
                                {range ? `${range} · ` : ""}
                                {games.length} juego{games.length === 1 ? "" : "s"}
                                {ev.location ? ` · ${ev.location}` : ""}
                                {ev.league ? ` · ${ev.league}` : ""}
                              </div>
                            </Link>
                            {canEdit && games.length === 0 && !ev.cancelled && (
                              <Link
                                href={`/${team.slug}/asistencia/evento/${ev.id}`}
                                className="text-xs font-bold text-gold hover:underline shrink-0"
                              >
                                {withAttendance.has(ev.id) ? "Asistencia ✓" : "Asistencia"}
                              </Link>
                            )}
                            {canEdit && (
                              <Link
                                href={`/${team.slug}/calendario/evento/${ev.id}/editar`}
                                className="text-xs font-bold text-gold hover:underline shrink-0"
                              >
                                Editar / juegos
                              </Link>
                            )}
                            {canEdit && <EventDeleteButton eventId={ev.id} hasGames={games.length > 0} />}
                          </div>
                          {games.length > 0 && (
                            <div className="border-t border-border divide-y divide-border">
                              {games.map((g) => {
                                const gp = clubParts(g.start_at);
                                return (
                                  <div key={g.id} className={`flex items-center gap-3 px-4 py-2.5 bg-panel2/40 ${g.cancelled ? "opacity-70" : ""}`}>
                                    <div className="w-16 shrink-0">
                                      <div className="text-[11px] font-bold text-gold uppercase">
                                        {DIAS[gp.dow]} {gp.day}
                                      </div>
                                      <div className="text-xs text-muted">{clubTime(g.start_at)}</div>
                                    </div>
                                    <div className="w-7 h-7 rounded-full bg-panel2 border border-borderMuted flex items-center justify-center overflow-hidden shrink-0">
                                      {g.opponent_logo_url ? (
                                        <img src={g.opponent_logo_url} alt={g.opponent ?? ""} className="w-full h-full object-cover" />
                                      ) : (
                                        <span className="text-[9px] font-bold text-muted">{(g.opponent ?? "?").slice(0, 2).toUpperCase()}</span>
                                      )}
                                    </div>
                                    <Link href={`/${team.slug}/calendario/evento/${g.id}`} className="flex-grow min-w-0 text-sm font-bold truncate">
                                      {g.cancelled && <span className="text-[10px] font-extrabold text-red mr-1.5">CANCELADO</span>}
                                      <span className={g.cancelled ? "line-through" : ""}>vs {g.opponent ?? "?"}</span>
                                      {g.location && g.location !== ev.location ? (
                                        <span className="text-xs text-muted font-semibold"> · {g.location}</span>
                                      ) : null}
                                    </Link>
                                    {canEdit && !g.cancelled && (
                                      <Link
                                        href={`/${team.slug}/asistencia/evento/${g.id}`}
                                        className="text-xs font-bold text-gold hover:underline shrink-0"
                                      >
                                        {withAttendance.has(g.id) ? "Asistencia ✓" : "Asistencia"}
                                      </Link>
                                    )}
                                    {canEdit && (
                                      <Link
                                        href={`/${team.slug}/calendario/evento/${g.id}/editar`}
                                        className="text-xs font-bold text-gold hover:underline shrink-0"
                                      >
                                        Editar
                                      </Link>
                                    )}
                                    {canEdit && <EventDeleteButton eventId={g.id} />}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }
                    return (
                    <div
                      key={ev.id}
                      className={`flex items-center gap-3 bg-panel border border-border rounded-xl px-4 py-3 ${ev.cancelled ? "opacity-70" : ""}`}
                    >
                      {ev.type === "game" && (
                        <div className="w-9 h-9 rounded-full bg-panel2 border border-borderMuted flex items-center justify-center overflow-hidden shrink-0">
                          {ev.opponent_logo_url ? (
                            <img src={ev.opponent_logo_url} alt={ev.opponent ?? ""} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] font-bold text-muted">
                              {(ev.opponent ?? "?").slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                      )}
                      <Link href={`/${team.slug}/calendario/evento/${ev.id}`} className="flex-grow min-w-0 block">
                        <div className="text-sm font-bold truncate">
                          {ev.cancelled && <span className="text-[10px] font-extrabold text-red mr-2">CANCELADO</span>}
                          <span className={ev.cancelled ? "line-through" : ""}>
                            {ev.type === "game" ? `vs ${ev.opponent ?? "?"}` : ev.title || TYPE_LABELS[ev.type]}
                          </span>
                        </div>
                        <div className="text-xs text-muted truncate">
                          {clubTime(ev.start_at)}
                          {ev.location ? ` · ${ev.location}` : ""}
                          {ev.league ? ` · ${ev.league}` : ""}
                        </div>
                      </Link>
                      {canEdit && ev.type !== "other" && !ev.cancelled && (
                        <Link
                          href={`/${team.slug}/asistencia/evento/${ev.id}`}
                          className="text-xs font-bold text-gold hover:underline shrink-0"
                        >
                          {withAttendance.has(ev.id) ? "Asistencia ✓" : "Tomar asistencia"}
                        </Link>
                      )}
                      {canEdit && (
                        <Link
                          href={`/${team.slug}/calendario/evento/${ev.id}/editar`}
                          className="text-xs font-bold text-gold hover:underline shrink-0"
                        >
                          Editar
                        </Link>
                      )}
                      {canEdit && <EventDeleteButton eventId={ev.id} seriesId={ev.series_id} />}
                    </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
