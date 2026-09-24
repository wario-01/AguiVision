import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getTeamBySlug, getMatches, getHighlights, getCurrentUser } from "@/lib/data";

export default async function TeamHome({ params }: { params: { teamSlug: string } }) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound(); // sin membresía en este equipo (o no existe)

  const user = await getCurrentUser();
  const firstName = user?.full_name?.split(" ")[0] ?? "";
  const matches = await getMatches(team.slug);
  const highlights = await getHighlights(team.slug);

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="inicio" />
      <div className="flex-grow overflow-y-auto p-11">
        <div className="mb-7">
          <div className="font-display text-2xl font-bold">Hola, {firstName}</div>
          <div className="text-muted text-sm mt-0.5">{team.name} · temporada 2026</div>
        </div>

        <div className="font-display text-lg font-semibold mb-3.5">Highlights recientes</div>
        <div className="grid grid-cols-4 gap-4 mb-8">
          {highlights.map((h) => (
            <div key={h.id}>
              <div className="w-full h-[110px] rounded-xl bg-panel2 border border-borderMuted mb-2" />
              <div className="text-sm font-bold">
                {h.label} · {h.player_name}
              </div>
              <div className="text-xs text-muted">min {h.minute} · {h.duration}</div>
            </div>
          ))}
          {highlights.length === 0 && (
            <div className="text-sm text-muted">Todavía no hay highlights para este equipo.</div>
          )}
        </div>

        <div className="font-display text-lg font-semibold mb-3.5">Partidos</div>
        <div className="bg-panel border border-border rounded-2xl overflow-hidden">
          {matches.map((m, i) => (
            <div
              key={m.id}
              className={`grid grid-cols-[1fr_140px_120px] items-center gap-4 px-5 py-3 ${
                i < matches.length - 1 ? "border-b border-border" : ""
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
            </div>
          ))}
          {matches.length === 0 && (
            <div className="px-5 py-4 text-sm text-muted">Todavía no hay partidos cargados.</div>
          )}
        </div>
      </div>
    </div>
  );
}
