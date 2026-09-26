import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getTeamBySlug, getHighlights } from "@/lib/data";
import MatchPlayer from "@/components/MatchPlayer";

export default async function HighlightPage({
  params,
}: {
  params: { teamSlug: string; highlightId: string };
}) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();

  const highlights = await getHighlights(team.slug);
  const highlight = highlights.find((h) => h.id === params.highlightId);
  if (!highlight) notFound();

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="highlights" />
      <div className="flex-grow overflow-y-auto p-11 max-w-3xl">
        <div className="font-display text-2xl font-bold mb-1">
          {highlight.label} · {highlight.player_name}
        </div>
        <div className="text-sm text-muted mb-7">min {highlight.minute} · {highlight.duration}</div>

        {highlight.clip_playback_id ? (
          <MatchPlayer playbackId={highlight.clip_playback_id} />
        ) : (
          <div className="border border-dashed border-borderMuted rounded-2xl p-10 text-center text-muted text-sm">
            Mux todavía está generando este clip — recargá la página en un rato.
          </div>
        )}
      </div>
    </div>
  );
}
