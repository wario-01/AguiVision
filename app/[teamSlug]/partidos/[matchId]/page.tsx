import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getTeamBySlug, getMatches, getPlayers } from "@/lib/data";
import MatchPlayer from "@/components/MatchPlayer";
import HighlightForm from "@/components/HighlightForm";
import DeleteMatchButtons from "@/components/DeleteMatchButtons";

export default async function MatchPage({
  params,
}: {
  params: { teamSlug: string; matchId: string };
}) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();

  const matches = await getMatches(team.slug);
  const match = matches.find((m) => m.id === params.matchId);
  if (!match) notFound();

  const canMarkHighlights = team.role === "coach" || team.role === "assistant";
  const players = canMarkHighlights ? await getPlayers(team.slug) : [];

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="inicio" />
      <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11 max-w-4xl">
        <div className="font-display text-2xl font-bold mb-1">
          {team.name} vs {match.opponent}
        </div>
        <div className="text-sm text-muted mb-7">{match.match_date}</div>

        {match.video_status === "ready" && match.video_playback_id ? (
          <MatchPlayer playbackId={match.video_playback_id} />
        ) : (
          <div className="border border-dashed border-borderMuted rounded-2xl p-10 text-center text-muted text-sm">
            {match.video_status === "processing" || match.video_status === "uploading"
              ? "El video todavía se está procesando — esta página se actualiza sola cuando esté listo (recargá en unos minutos)."
              : "Este partido todavía no tiene video subido."}
          </div>
        )}

        {canMarkHighlights && <DeleteMatchButtons matchId={match.id} teamSlug={team.slug} />}

        {canMarkHighlights && match.video_status === "ready" && (
          <HighlightForm matchId={match.id} players={players} />
        )}
      </div>
    </div>
  );
}
