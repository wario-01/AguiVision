import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getTeamBySlug, getMatches, getHighlights, getCurrentUser, getUpcomingEvents } from "@/lib/data";

const TYPE_LABELS: Record<string, string> = {
  practice: "Entrenamiento",
  tournament: "Torneo",
  other: "Evento",
};

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export default async function TeamHome({ params }: { params: { teamSlug: string } }) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound(); // sin membresía en este equipo (o no existe)

  const user = await getCurrentUser();
  const firstName = user?.full_name?.split(" ")[0] ?? "";
  const matches = await getMatches(team.slug);
  const highlights = await getHighlights(team.slug);
  const upcomingEvents = await getUpcomingEvents(team.slug, 5);

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="inicio" />
      <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11">
        <div className="mb-7 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-display text-2xl font-bold">Hola, {firstName}</div>
            <div className="text-muted text-sm mt-0.5">{team.name} · temporada 2026</div>
          </div>
          {(team.role === "coach" || team.role === "assistant") && (
            <a
              href={`/${team.slug}/transmitir`}
              className="flex items-center gap-2 bg-red text-redText rounded-lg px-4 py-2.5 text-sm font-extrabold"
            >
              <span className="w-2 h-2 rounded-full bg-redText" />
              Transmitir en vivo
            </a>
          )}
        </div>

        {upcomingEvents.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-3.5">
              <div className="font-display text-lg font-semibold">Próximos eventos</div>
              <a href={`/${team.slug}/calendario`} className="text-xs font-bold text-gold">
                Ver calendario
              </a>
            </div>
            <div className="flex flex-col gap-3 mb-8">
              {upcomingEvents.map((g) => {
                const d = new Date(g.start_at);
                if (g.type !== "game") {
                  return (
                    <div
                      key={g.id}
                      className="flex items-center gap-4 bg-panel border border-border rounded-2xl px-5 py-4"
                    >
                      <div className="w-11 h-11 rounded-full bg-panel2 border border-borderMuted flex items-center justify-center shrink-0">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#8CA0C7" strokeWidth={2}>
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="text-sm font-bold truncate">{g.title || TYPE_LABELS[g.type] || "Evento"}</div>
                        <div className="text-xs text-muted truncate">
                          {DIAS[d.getDay()]}, {d.getDate()} {MESES[d.getMonth()]} ·{" "}
                          {d.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" })}
                          {g.location ? ` · ${g.location}` : ""}
                        </div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={g.id} className="bg-panel border border-border rounded-2xl overflow-hidden">
                    {g.league && (
                      <div className="px-5 pt-3 text-[11px] font-bold text-muted uppercase tracking-wide">
                        {g.league}
                      </div>
                    )}
                    <div className="flex items-center gap-4 px-5 py-4">
                      <div className="w-12 h-12 rounded-full bg-panel2 border border-borderMuted flex items-center justify-center overflow-hidden shrink-0">
                        <img src="/logo.png" alt={team.name} className="w-full h-full object-contain" />
                      </div>
                      <div className="flex-grow text-center">
                        <div className="font-display text-2xl font-bold">
                          {d.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" })}
                        </div>
                        <div className="text-xs text-muted mt-0.5">
                          {DIAS[d.getDay()]}, {d.getDate()} {MESES[d.getMonth()]}
                        </div>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-panel2 border border-borderMuted flex items-center justify-center overflow-hidden shrink-0">
                        {g.opponent_logo_url ? (
                          <img src={g.opponent_logo_url} alt={g.opponent ?? ""} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] font-bold text-muted">
                            {(g.opponent ?? "?").slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-5 pb-4 -mt-2">
                      <span className="text-sm font-bold">{team.name}</span>
                      <span className="text-sm font-bold text-right">{g.opponent}</span>
                    </div>
                    {g.location && (
                      <div className="px-5 pb-3 text-xs text-muted border-t border-border pt-3">{g.location}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="flex items-center justify-between mb-3.5">
          <div className="font-display text-lg font-semibold">Highlights recientes</div>
          {highlights.length > 0 && (
            <a href={`/${team.slug}/highlights`} className="text-xs font-bold text-gold">
              Ver todos
            </a>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {highlights.slice(0, 6).map((h) => (
            <a href={`/${team.slug}/highlights/${h.id}`} key={h.id}>
              <div className="w-full h-[110px] rounded-xl bg-panel2 border border-borderMuted relative mb-2 flex items-center justify-center">
                {h.clip_playback_id ? (
                  <svg viewBox="0 0 24 24" width="26" height="26">
                    <circle cx="12" cy="12" r="11" fill="rgba(0,0,0,0.45)" />
                    <path d="M10 8l6 4-6 4z" fill="#F5EFD6" />
                  </svg>
                ) : (
                  <span className="text-[10px] font-bold text-muted">Procesando...</span>
                )}
              </div>
              <div className="text-sm font-bold">
                {h.label} · {h.player_name}
              </div>
              <div className="text-xs text-muted">min {h.minute} · {h.duration}</div>
            </a>
          ))}
          {highlights.length === 0 && (
            <div className="text-sm text-muted col-span-2 md:col-span-4">Todavía no hay highlights para este equipo.</div>
          )}
        </div>

        <div className="flex items-center justify-between mb-3.5">
          <div className="font-display text-lg font-semibold">Partidos</div>
          {matches.length > 0 && (
            <a href={`/${team.slug}/partidos`} className="text-xs font-bold text-gold">
              Ver todos
            </a>
          )}
        </div>
        <div className="bg-panel border border-border rounded-2xl overflow-hidden">
          {matches.slice(0, 5).map((m, i, arr) => (
            <a
              href={`/${team.slug}/partidos/${m.id}`}
              key={m.id}
              className={`flex flex-col gap-1.5 md:grid md:grid-cols-[1fr_140px_120px] md:items-center md:gap-4 px-5 py-3 hover:bg-panel2 ${
                i < arr.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <span className="text-sm font-bold">{team.name} vs {m.opponent}</span>
              <span className="text-xs text-muted">{m.match_date}</span>
              <span
                className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full w-fit ${
                  m.video_status === "ready"
                    ? "bg-goldBgDim text-goldText"
                    : "bg-amberBg text-amberText"
                }`}
              >
                {m.video_status === "ready" ? "Analizado" : "Procesando"}
              </span>
            </a>
          ))}
          {matches.length === 0 && (
            <div className="px-5 py-4 text-sm text-muted">Todavía no hay partidos cargados.</div>
          )}
        </div>
      </div>
    </div>
  );
}
