import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import StartStreamForm from "@/components/StartStreamForm";
import EndStreamButton from "@/components/EndStreamButton";
import { getTeamBySlug, getActiveLiveStreamsForTeam } from "@/lib/data";

export default async function TransmitirPage({ params }: { params: { teamSlug: string } }) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();
  if (team.role !== "coach" && team.role !== "assistant") notFound();

  const activeStreams = await getActiveLiveStreamsForTeam(team.slug);

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="inicio" />
      <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11 max-w-lg">
        <div className="font-display text-2xl font-bold mb-1">Transmitir en vivo</div>
        <div className="text-sm text-muted mb-7">{team.name}</div>

        {activeStreams.length > 0 && (
          <div className="bg-panel border border-border rounded-2xl overflow-hidden mb-6">
            <div className="px-5 py-3 border-b border-border text-xs font-bold text-muted uppercase tracking-wide">
              Sin terminar
            </div>
            {activeStreams.map((s, i) => (
              <div
                key={s.id}
                className={`flex items-center justify-between px-5 py-3 ${
                  i < activeStreams.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${s.status === "live" ? "bg-red" : "bg-muted"}`} />
                  <span className="text-sm font-bold truncate">{s.title}</span>
                  <span className="text-xs text-muted shrink-0">
                    ({s.status === "live" ? "en vivo" : "esperando señal"})
                  </span>
                </div>
                <EndStreamButton liveStreamId={s.id} />
              </div>
            ))}
          </div>
        )}

        <StartStreamForm teamSlug={team.slug} />
      </div>
    </div>
  );
}
