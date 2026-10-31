// app/[teamSlug]/calendario/evento/[eventId]/page.tsx
//
// Detalle de un evento (partido, torneo, entrenamiento u otro). Lo ve todo el equipo.
// Si el evento se canceló, se muestra el aviso con el motivo.

import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getTeamBySlug, getTournamentGames } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { getEventsWithAttendance } from "@/lib/data-asistencia";
import { clubParts, clubTime } from "@/lib/tz";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const TYPE_LABELS: Record<string, string> = { game: "Partido", practice: "Entrenamiento", tournament: "Torneo", other: "Evento" };

const dateLabel = (iso: string) => {
  const p = clubParts(iso);
  return `${DIAS[p.dow]} ${p.day} de ${MESES[p.month]}`;
};

export default async function EventoDetallePage({ params }: { params: { teamSlug: string; eventId: string } }) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();

  const supabase = await createClient();
  if (!supabase) notFound();
  const { data: event } = await supabase.from("events").select("*").eq("id", params.eventId).single();
  if (!event || event.team_id !== team.id) notFound();

  const canEdit = team.role === "coach" || team.role === "assistant";
  const isTournament = event.type === "tournament";
  const games = isTournament ? await getTournamentGames([event.id]) : [];
  const { data: parent } = event.parent_event_id
    ? await supabase.from("events").select("id, title").eq("id", event.parent_event_id).maybeSingle()
    : { data: null };
  const done = canEdit ? await getEventsWithAttendance([event.id]) : new Set<string>();

  const title =
    event.type === "game" ? `${team.name} vs ${event.opponent ?? "?"}` : event.title || TYPE_LABELS[event.type] || "Evento";
  const sp = clubParts(event.start_at);
  const ep = event.end_at ? clubParts(event.end_at) : null;
  const multiDay = isTournament && ep && ep.ymd !== sp.ymd;
  const cancelled = !!event.cancelled;

  const row = (label: string, value: string | null | undefined) =>
    value ? (
      <div className="py-3 border-t border-border first:border-t-0">
        <div className="text-[11px] font-bold text-muted uppercase tracking-wide">{label}</div>
        <div className="text-sm font-semibold mt-0.5 whitespace-pre-line">{value}</div>
      </div>
    ) : null;

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="calendario" />
      <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11 max-w-2xl">
        <div className="text-xs text-muted mb-1">
          <Link href={`/${team.slug}/calendario?m=${sp.year}-${sp.month}`} className="font-bold hover:text-text">
            Calendario
          </Link>{" "}
          / Detalle
        </div>

        {cancelled && (
          <div className="rounded-xl border border-red bg-panel px-4 py-3 mb-4">
            <div className="text-sm font-extrabold text-red tracking-wide">EVENTO CANCELADO</div>
            {event.cancel_reason && <div className="text-sm mt-1">{event.cancel_reason}</div>}
          </div>
        )}

        <div className="text-[11px] font-extrabold uppercase tracking-widest text-gold mb-1">
          {TYPE_LABELS[event.type] ?? "Evento"}
        </div>
        <div className={`font-display text-2xl font-bold mb-5 ${cancelled ? "line-through opacity-70" : ""}`}>{title}</div>

        {event.type === "game" && (
          <div className="flex items-center justify-center gap-6 bg-panel border border-border rounded-2xl py-5 mb-5">
            <div className="w-16 h-16 rounded-full bg-panel2 border border-borderMuted flex items-center justify-center overflow-hidden">
              <img src="/logo.png" alt={team.name} className="w-full h-full object-contain" />
            </div>
            <span className="font-display text-xl font-bold text-muted">VS</span>
            <div className="w-16 h-16 rounded-full bg-panel2 border border-borderMuted flex items-center justify-center overflow-hidden">
              {event.opponent_logo_url ? (
                <img src={event.opponent_logo_url} alt={event.opponent ?? ""} className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-muted">{(event.opponent ?? "?").slice(0, 2).toUpperCase()}</span>
              )}
            </div>
          </div>
        )}

        <div className={`bg-panel border border-border rounded-2xl px-5 py-2 ${cancelled ? "opacity-80" : ""}`}>
          {row("Fecha", multiDay ? `${dateLabel(event.start_at)} al ${dateLabel(event.end_at)}` : dateLabel(event.start_at))}
          {!isTournament && row("Hora", clubTime(event.start_at))}
          {event.type === "game" && row("Rival", event.opponent)}
          {row("Liga / división", event.league)}
          {row("Lugar", event.location)}
          {row("Notas", event.notes)}
          {parent && (
            <div className="py-3 border-t border-border">
              <div className="text-[11px] font-bold text-muted uppercase tracking-wide">Forma parte del torneo</div>
              <Link href={`/${team.slug}/calendario/evento/${parent.id}`} className="text-sm font-bold text-gold hover:underline">
                {parent.title || "Torneo"} →
              </Link>
            </div>
          )}
        </div>

        {isTournament && games.length > 0 && (
          <div className="mt-6">
            <div className="font-display text-lg font-semibold mb-3">Juegos del torneo</div>
            <div className="flex flex-col gap-2">
              {games.map((g) => {
                const gp = clubParts(g.start_at);
                return (
                  <Link
                    key={g.id}
                    href={`/${team.slug}/calendario/evento/${g.id}`}
                    className={`flex items-center gap-3 bg-panel border border-border rounded-xl px-4 py-3 hover:border-borderMuted ${g.cancelled ? "opacity-70" : ""}`}
                  >
                    <div className="w-20 shrink-0">
                      <div className="text-[11px] font-bold text-gold uppercase">
                        {DIAS[gp.dow].slice(0, 3)} {gp.day} {MESES[gp.month].slice(0, 3)}
                      </div>
                      <div className="text-xs text-muted">{clubTime(g.start_at)}</div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-panel2 border border-borderMuted flex items-center justify-center overflow-hidden shrink-0">
                      {g.opponent_logo_url ? (
                        <img src={g.opponent_logo_url} alt={g.opponent ?? ""} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[9px] font-bold text-muted">{(g.opponent ?? "?").slice(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex-grow min-w-0 text-sm font-bold truncate">
                      {g.cancelled && <span className="text-[10px] font-extrabold text-red mr-1.5">CANCELADO</span>}
                      <span className={g.cancelled ? "line-through" : ""}>vs {g.opponent ?? "?"}</span>
                      {g.location && g.location !== event.location ? (
                        <span className="text-xs text-muted font-semibold"> · {g.location}</span>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {canEdit && (
          <div className="flex gap-3 flex-wrap mt-6">
            {!cancelled && event.type !== "other" && !(isTournament && games.length > 0) && (
              <Link
                href={`/${team.slug}/asistencia/evento/${event.id}`}
                className="bg-gold text-bg rounded-lg px-4 py-2.5 text-sm font-extrabold"
              >
                {done.has(event.id) ? "Ver / corregir asistencia" : "Tomar asistencia"}
              </Link>
            )}
            <Link
              href={`/${team.slug}/calendario/evento/${event.id}/editar`}
              className="bg-panel border border-border rounded-lg px-4 py-2.5 text-sm font-bold hover:border-borderMuted"
            >
              {cancelled ? "Editar / reactivar" : "Editar o cancelar"}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
