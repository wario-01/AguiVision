import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getTeamBySlug, getHighlights } from "@/lib/data";

export default async function HighlightsPage({ params }: { params: { teamSlug: string } }) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();

  const highlights = await getHighlights(team.slug);

  // Agrupar por partido — el orden de aparición sigue el de getHighlights
  // (más recientes primero), así que los grupos ya quedan en ese orden.
  const groups = new Map<
    string,
    { opponent: string; date: string; teamId?: string; teamName?: string; items: typeof highlights }
  >();
  for (const h of highlights) {
    if (!groups.has(h.match_id)) {
      groups.set(h.match_id, {
        opponent: h.match_opponent,
        date: h.match_date,
        teamId: h.team_id,
        teamName: h.team_name,
        items: [],
      });
    }
    groups.get(h.match_id)!.items.push(h);
  }

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="highlights" />
      <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11">
        <div className="font-display text-2xl font-bold mb-1">Highlights</div>
        <div className="text-sm text-muted mb-7">{team.name}</div>

        <div className="flex flex-col gap-8 mb-8">
          {Array.from(groups.entries()).map(([matchId, group]) => (
            <div key={matchId}>
              {/* El enlace al partido solo sirve si es de este equipo (papás de un
                  niño que juega en 2 equipos ven highlights del otro equipo también). */}
              {!group.teamId || group.teamId === team.id ? (
                <a
                  href={`/${team.slug}/partidos/${matchId}`}
                  className="flex items-baseline gap-2 mb-3 hover:opacity-80"
                >
                  <span className="font-display text-base font-semibold">vs {group.opponent}</span>
                  <span className="text-xs text-muted">
                    {group.date ? new Date(group.date).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Chicago" }) : ""}
                  </span>
                  {group.teamName && <span className="text-xs text-gold">{group.teamName}</span>}
                </a>
              ) : (
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="font-display text-base font-semibold">vs {group.opponent}</span>
                  <span className="text-xs text-muted">
                    {group.date ? new Date(group.date).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Chicago" }) : ""}
                  </span>
                  {group.teamName && <span className="text-xs text-gold">{group.teamName}</span>}
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {group.items.map((h) => (
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
                      <span className="absolute bottom-1.5 right-2 bg-black/60 text-text text-[10px] font-bold px-1.5 py-0.5 rounded">
                        {h.duration}
                      </span>
                    </div>
                    <div className="text-sm font-bold">{h.label} · {h.player_name}</div>
                    {h.shared_with_team && (
                      <span className="inline-block border border-goldBorderDim text-goldText text-[10px] font-extrabold px-2 py-0.5 rounded-full my-0.5">
                        Compartido con el equipo
                      </span>
                    )}
                    <div className="text-xs text-muted">min {h.minute}</div>
                  </a>
                ))}
              </div>
            </div>
          ))}
          {highlights.length === 0 && (
            <div className="text-sm text-muted">Todavía no hay highlights para este equipo.</div>
          )}
        </div>

        {/* Evaluación del jugador — roadmap V2, no funcional todavía */}
        <div className="border border-dashed border-borderMuted rounded-2xl p-6 bg-sidebar max-w-2xl">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="#8CA0C7" strokeWidth={2}>
                <rect x="5" y="4" width="14" height="17" rx="2" />
                <path d="M9 4V3a1 1 0 011-1h4a1 1 0 011 1v1M9 11l2 2 4-4" />
              </svg>
              <span className="font-display text-base font-semibold">Evaluación del jugador</span>
            </div>
            <span className="border border-goldBorderDim text-goldText text-[11px] font-extrabold px-2.5 py-1 rounded-full">
              Próximamente · en el roadmap
            </span>
          </div>
          <div className="text-sm text-muted leading-relaxed">
            Calificar técnica, actitud y progreso después de cada partido, con notas visibles para el jugador y sus padres.
          </div>
        </div>
      </div>
    </div>
  );
}
