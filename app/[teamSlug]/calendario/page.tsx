import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import NewEventToggle from "@/components/NewEventToggle";
import EventDeleteButton from "@/components/EventDeleteButton";
import { getTeamBySlug, getEvents } from "@/lib/data";

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

function monthRange(year: number, month: number) {
  const from = new Date(Date.UTC(year, month, 1)).toISOString();
  const to = new Date(Date.UTC(year, month + 1, 1)).toISOString();
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

  const now = new Date();
  const [y, m] = (searchParams.m ?? `${now.getFullYear()}-${now.getMonth()}`).split("-").map(Number);
  const range = monthRange(y, m);
  const events = await getEvents(team.slug, range);

  const prevM = m === 0 ? 11 : m - 1;
  const prevY = m === 0 ? y - 1 : y;
  const nextM = m === 11 ? 0 : m + 1;
  const nextY = m === 11 ? y + 1 : y;

  // Agrupar por día
  const byDay = new Map<string, typeof events>();
  for (const ev of events) {
    const d = new Date(ev.start_at);
    const key = d.toISOString().slice(0, 10);
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

        {canEdit && <NewEventToggle teamSlug={team.slug} />}

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
                  {byDay.get(day)!.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-center gap-3 bg-panel border border-border rounded-xl px-4 py-3"
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
                      <div className="flex-grow min-w-0">
                        <div className="text-sm font-bold truncate">
                          {ev.type === "game" ? `vs ${ev.opponent ?? "?"}` : ev.title || TYPE_LABELS[ev.type]}
                        </div>
                        <div className="text-xs text-muted truncate">
                          {new Date(ev.start_at).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" })}
                          {ev.location ? ` · ${ev.location}` : ""}
                          {ev.league ? ` · ${ev.league}` : ""}
                        </div>
                      </div>
                      {canEdit && <EventDeleteButton eventId={ev.id} />}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
