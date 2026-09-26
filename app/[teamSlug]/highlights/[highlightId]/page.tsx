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
      <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11 max-w-3xl">
        <div className="font-display text-2xl font-bold mb-1">
          {highlight.label} · {highlight.player_name}
        </div>
        <div className="text-sm text-muted mb-7">min {highlight.minute} · {highlight.duration}</div>

        {highlight.clip_playback_id ? (
          <>
            <MatchPlayer playbackId={highlight.clip_playback_id} />
            <a
              href={`https://stream.mux.com/${highlight.clip_playback_id}/capped-1080p.mp4?download=${encodeURIComponent(
                `${highlight.label}-${highlight.player_name}`
              )}`}
              className="inline-flex items-center gap-2 mt-4 bg-panel border border-border rounded-lg px-4 py-2.5 text-sm font-bold hover:border-borderMuted"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#F5EFD6" strokeWidth={2}>
                <path d="M12 3v12M7 10l5 5 5-5M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Descargar highlight
            </a>
            <div className="text-xs text-muted mt-2">
              Puede tardar un minuto extra en estar disponible después de que el clip se ve por primera vez.
            </div>
          </>
        ) : (
          <div className="border border-dashed border-borderMuted rounded-2xl p-10 text-center text-muted text-sm">
            Mux todavía está generando este clip — recargá la página en un rato.
          </div>
        )}
      </div>
    </div>
  );
}
