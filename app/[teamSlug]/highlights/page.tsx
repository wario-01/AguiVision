import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getTeamBySlug, getHighlights } from "@/lib/data";

export default async function HighlightsPage({ params }: { params: { teamSlug: string } }) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();

  const highlights = await getHighlights(team.slug);

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="highlights" />
      <div className="flex-grow overflow-y-auto p-11">
        <div className="font-display text-2xl font-bold mb-1">Highlights</div>
        <div className="text-sm text-muted mb-7">{team.name}</div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          {highlights.map((h) => (
            <div key={h.id}>
              <div className="w-full h-[110px] rounded-xl bg-panel2 border border-borderMuted relative mb-2 flex items-center justify-center">
                <svg viewBox="0 0 24 24" width="26" height="26">
                  <circle cx="12" cy="12" r="11" fill="rgba(0,0,0,0.45)" />
                  <path d="M10 8l6 4-6 4z" fill="#F5EFD6" />
                </svg>
                <span className="absolute bottom-1.5 right-2 bg-black/60 text-text text-[10px] font-bold px-1.5 py-0.5 rounded">
                  {h.duration}
                </span>
              </div>
              <div className="text-sm font-bold">{h.label} · {h.player_name}</div>
              <div className="text-xs text-muted">min {h.minute}</div>
            </div>
          ))}
          {highlights.length === 0 && (
            <div className="text-sm text-muted">Todavía no hay highlights para este equipo.</div>
          )}
        </div>

        {/* Evaluación del jugador — roadmap V2, no funcional todavía */}
        <div className="border border-dashed border-borderMuted rounded-2xl p-6 bg-sidebar max-w-2xl">
          <div className="flex items-center justify-between mb-3">
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
