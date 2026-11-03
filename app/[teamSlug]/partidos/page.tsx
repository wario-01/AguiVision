import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import MuxThumb from "@/components/MuxThumb";
import { getTeamBySlug, getMatches } from "@/lib/data";
import type { Match } from "@/lib/data";
import { clubDateLabel } from "@/lib/tz";

export default async function PartidosPage({ params }: { params: { teamSlug: string } }) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();

  const matches = await getMatches(team.slug, { hideGhosts: true });
  // Con jornada: en el orden en que se jugaron (J1, J2…). Sin jornada: los más nuevos primero.
  const numbered = matches.filter((m) => m.jornada != null).sort((a, b) => (a.jornada as number) - (b.jornada as number));
  const unnumbered = matches.filter((m) => m.jornada == null);
  const groups: { title: string | null; items: Match[] }[] = [];
  if (numbered.length > 0) {
    groups.push({ title: "Por jornada", items: numbered });
    if (unnumbered.length > 0) groups.push({ title: "Sin jornada", items: unnumbered });
  } else {
    groups.push({ title: null, items: unnumbered });
  }

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="inicio" />
      <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11 max-w-3xl">
        <div className="font-display text-2xl font-bold mb-1">Partidos</div>
        <div className="text-sm text-muted mb-7">{team.name} · {matches.length} en total</div>

        {groups.map((g) => (
          <div key={g.title ?? "todos"} className="mb-6">
            {g.title && <div className="text-xs font-bold text-gold uppercase tracking-wide mb-2">{g.title}</div>}
            <div className="bg-panel border border-border rounded-2xl overflow-hidden">
              {g.items.map((m, i, arr) => (
                <a
                  href={`/${team.slug}/partidos/${m.id}`}
                  key={m.id}
                  className={`flex items-center gap-3 px-5 py-3 hover:bg-panel2 ${
                    i < arr.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <MuxThumb playbackId={m.video_playback_id} width={240} time={30} className="w-24 h-14 rounded-lg shrink-0" />
                  <div className="flex flex-col gap-1.5 md:grid md:grid-cols-[1fr_140px_120px] md:items-center md:gap-4 flex-grow min-w-0">
                    <span className="text-sm font-bold">
                      {m.jornada != null && <span className="text-gold">J{m.jornada} · </span>}
                      {team.name} vs {m.opponent}
                    </span>
                    <span className="text-xs text-muted">{clubDateLabel(m.match_date)}</span>
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
            </div>
          </div>
        ))}
        {matches.length === 0 && (
          <div className="bg-panel border border-border rounded-2xl px-5 py-4 text-sm text-muted">Todavía no hay partidos cargados.</div>
        )}
      </div>
    </div>
  );
}
