import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getTeamBySlug, getMatches } from "@/lib/data";

export default async function PartidosPage({ params }: { params: { teamSlug: string } }) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();

  const matches = await getMatches(team.slug, { hideGhosts: true });

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="inicio" />
      <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11 max-w-3xl">
        <div className="font-display text-2xl font-bold mb-1">Partidos</div>
        <div className="text-sm text-muted mb-7">{team.name} · {matches.length} en total</div>

        <div className="bg-panel border border-border rounded-2xl overflow-hidden">
          {matches.map((m, i) => (
            <a
              href={`/${team.slug}/partidos/${m.id}`}
              key={m.id}
              className={`flex flex-col gap-1.5 md:grid md:grid-cols-[1fr_140px_120px] md:items-center md:gap-4 px-5 py-3 hover:bg-panel2 ${
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
