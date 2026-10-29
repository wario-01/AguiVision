import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import MuxThumb from "@/components/MuxThumb";
import Link from "next/link";
import { getMeasurements } from "@/lib/data-crecimiento";
import { clubParts, clubTime } from "@/lib/tz";
import { teamAccent } from "@/lib/team-accent";
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
  const matches = await getMatches(team.slug, { hideGhosts: true });
  const highlights = await getHighlights(team.slug);
  const upcomingEvents = await getUpcomingEvents(team.slug, 5);

  // Aviso de IMC para la familia: solo si la última medición pide atención.
  let growthAlert: string | null = null;
  if ((team.role === "parent" || team.role === "player") && team.player_id) {
    const ms = await getMeasurements(team.player_id);
    const last = ms[ms.length - 1];
    if (last?.assessment?.needsAttention) {
      growthAlert = last.assessment.title;
    }
  }

  const accent = teamAccent(team.age_category);
  const next = upcomingEvents[0] ?? null;
  const restEvents = upcomingEvents.slice(1);
  const lastMatch = matches.find((m) => m.video_playback_id) ?? null;
  const daysUntil = (iso: string) => {
    const a = clubParts(new Date()).ymd.split("-").map(Number);
    const b = clubParts(new Date(iso)).ymd.split("-").map(Number);
    return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000);
  };
  const whenLabel = (iso: string) => {
    const n = daysUntil(iso);
    return n <= 0 ? "Hoy" : n === 1 ? "Mañana" : `En ${n} días`;
  };

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="inicio" />
      <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11">
        <div className="mb-7 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-display text-2xl font-bold">Hola, {firstName}</div>
            <div className="text-muted text-sm mt-0.5 flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: accent }} />
              {team.name} · temporada 2026
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {team.standings_url && (
              <a
                href={team.standings_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-panel border border-borderMuted text-gold rounded-lg px-4 py-2.5 text-sm font-extrabold"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Standings
              </a>
            )}
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
        </div>

        {growthAlert && (
          <Link
            href={`/${team.slug}/crecimiento`}
            className="block bg-goldBgDim border border-goldBorderDim rounded-2xl px-5 py-4 mb-7"
          >
            <div className="text-sm font-bold text-gold">Aviso de crecimiento: {growthAlert}</div>
            <div className="text-xs text-muted mt-0.5">Toca para ver el detalle y la gráfica.</div>
          </Link>
        )}

        {next && (
          <div
            className="rounded-2xl border border-border bg-panel overflow-hidden mb-8"
            style={{ borderTop: `4px solid ${accent}` }}
          >
            <div className="px-5 pt-4 flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-gold">
                Siguiente · {next.type === "game" ? "Partido" : TYPE_LABELS[next.type] || "Evento"}
              </span>
              <span className="text-[11px] font-extrabold rounded-full px-2.5 py-1 bg-goldBgDim text-goldText border border-goldBorderDim">
                {whenLabel(next.start_at)}
              </span>
            </div>
            <div className="px-5 py-4 flex items-center gap-4">
              <div className="text-center shrink-0">
                <div className="font-display text-4xl font-bold leading-none">{clubTime(new Date(next.start_at))}</div>
                <div className="text-xs text-muted mt-1.5">
                  {DIAS[clubParts(new Date(next.start_at)).dow]}, {clubParts(new Date(next.start_at)).day}{" "}
                  {MESES[clubParts(new Date(next.start_at)).month]}
                </div>
              </div>
              <div className="min-w-0 flex-grow border-l border-border pl-4">
                <div className="text-base font-bold truncate">
                  {next.type === "game" ? `${team.name} vs ${next.opponent ?? ""}` : next.title || TYPE_LABELS[next.type] || "Evento"}
                </div>
                {next.location && <div className="text-xs text-muted mt-1 truncate">{next.location}</div>}
                {next.league && <div className="text-[11px] text-muted mt-0.5 truncate">{next.league}</div>}
              </div>
            </div>
          </div>
        )}

        {restEvents.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-3.5">
              <div className="font-display text-lg font-semibold">Después</div>
              <a href={`/${team.slug}/calendario`} className="text-xs font-bold text-gold">
                Ver calendario
              </a>
            </div>
            <div className="flex flex-col gap-3 mb-8">
              {restEvents.map((g) => {
                const d = new Date(g.start_at);
                if (g.type !== "game") {
                  return (
                    <div
                      key={g.id}
                      className="flex items-center gap-4 bg-panel border border-border rounded-2xl px-5 py-4"
                    >
                      <div className="w-11 h-11 rounded-full bg-panel2 border border-borderMuted flex items-center justify-center shrink-0">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#A9C0DD" strokeWidth={2}>
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="text-sm font-bold truncate">{g.title || TYPE_LABELS[g.type] || "Evento"}</div>
                        <div className="text-xs text-muted truncate">
                          {DIAS[clubParts(d).dow]}, {clubParts(d).day} {MESES[clubParts(d).month]} ·{" "}
                          {clubTime(d)}
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
                          {clubTime(d)}
                        </div>
                        <div className="text-xs text-muted mt-0.5">
                          {DIAS[clubParts(d).dow]}, {clubParts(d).day} {MESES[clubParts(d).month]}
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

        {lastMatch && (
          <>
            <div className="font-display text-lg font-semibold mb-3.5">Último partido</div>
            <a
              href={`/${team.slug}/partidos/${lastMatch.id}`}
              className="block bg-panel border border-border rounded-2xl overflow-hidden mb-8 hover:border-borderMuted transition-colors"
            >
              <MuxThumb playbackId={lastMatch.video_playback_id} width={960} time={30} play className="w-full h-[190px] md:h-[260px]" />
              <div className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate">{team.name} vs {lastMatch.opponent}</div>
                  <div className="text-xs text-muted">{lastMatch.match_date}</div>
                </div>
                <span className="text-xs font-extrabold text-gold shrink-0">Ver partido</span>
              </div>
            </a>
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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {highlights.slice(0, 6).map((h) => (
            <a href={`/${team.slug}/highlights/${h.id}`} key={h.id} className="group">
              <MuxThumb playbackId={h.clip_playback_id} className="w-full h-[130px] md:h-[170px] rounded-xl mb-2 group-hover:ring-2 group-hover:ring-cream/60 transition" />
              <div className="text-sm font-bold">
                {h.label} · {h.player_name}
              </div>
              <div className="text-xs text-muted">min {h.minute} · {h.duration}</div>
            </a>
          ))}
          {highlights.length === 0 && (
            <div className="text-sm text-muted col-span-2 md:col-span-3">Todavía no hay highlights para este equipo.</div>
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
              className={`flex items-center gap-3 px-5 py-3 hover:bg-panel2 ${
                i < arr.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <MuxThumb playbackId={m.video_playback_id} width={240} time={30} className="w-24 h-14 rounded-lg shrink-0" />
              <div className="flex flex-col gap-1.5 md:grid md:grid-cols-[1fr_140px_120px] md:items-center md:gap-4 flex-grow min-w-0">
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
              </div>
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
