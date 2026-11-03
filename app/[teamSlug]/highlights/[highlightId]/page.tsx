import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getTeamBySlug, getHighlights } from "@/lib/data";
import MatchPlayer from "@/components/MatchPlayer";
import AnnotatedPlayer from "@/components/AnnotatedPlayer";
import { createClient } from "@/lib/supabase/server";
import { cleanAnnotations } from "@/lib/annotations";
import Link from "next/link";
import DeleteHighlightButton from "@/components/DeleteHighlightButton";
import ShareHighlightToggle from "@/components/ShareHighlightToggle";

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

  const canDelete = team.role === "coach" || team.role === "assistant";

  // Dibujos del entrenador (si la columna aún no existe, simplemente no hay dibujos)
  let annotations: ReturnType<typeof cleanAnnotations> = [];
  try {
    const supabase = await createClient();
    if (supabase) {
      const { data, error } = await supabase.from("highlights").select("annotations").eq("id", highlight.id).maybeSingle();
      if (!error) annotations = cleanAnnotations((data as any)?.annotations);
    }
  } catch {}

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="highlights" />
      <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11 max-w-3xl">
        <div className="font-display text-2xl font-bold mb-1">
          {highlight.label} · {highlight.player_name}
        </div>
        <div className="text-sm text-muted mb-4">min {highlight.minute} · {highlight.duration}</div>
        {highlight.notas && (
          <div className="bg-panel border border-border rounded-xl px-4 py-3 mb-6">
            <div className="text-xs font-bold text-muted mb-1">Nota del entrenador</div>
            <div className="text-sm whitespace-pre-wrap">{highlight.notas}</div>
          </div>
        )}

        {highlight.clip_playback_id ? (
          <>
            {annotations.length > 0 ? (
              <AnnotatedPlayer playbackId={highlight.clip_playback_id} annotations={annotations} />
            ) : (
              <MatchPlayer playbackId={highlight.clip_playback_id} />
            )}
            <a
              href={`https://stream.mux.com/${highlight.clip_playback_id}/capped-1080p.mp4?download=${encodeURIComponent(
                `${highlight.label}-${highlight.player_name}`
              )}`}
              className="inline-flex items-center gap-2 mt-4 bg-panel border border-border rounded-lg px-4 py-2.5 text-sm font-bold hover:border-borderMuted"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#FFFFFF" strokeWidth={2}>
                <path d="M12 3v12M7 10l5 5 5-5M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Descargar highlight
            </a>
            <div className="text-xs text-muted mt-2">
              Puede tardar un minuto extra en estar disponible después de que el clip se ve por primera vez.
              {annotations.length > 0 && " El archivo descargado es el video original, sin los dibujos."}
            </div>
            {canDelete && (
              <Link
                href={`/${team.slug}/highlights/${highlight.id}/dibujar`}
                className="inline-flex items-center gap-2 mt-4 ml-2 bg-gold text-bg rounded-lg px-4 py-2.5 text-sm font-extrabold"
              >
                ✎ {annotations.length > 0 ? "Editar dibujos" : "Dibujar sobre el video"}
              </Link>
            )}
          </>
        ) : (
          <div className="border border-dashed border-borderMuted rounded-2xl p-10 text-center text-muted text-sm">
            Mux todavía está generando este clip — recargá la página en un rato.
          </div>
        )}

        {canDelete && (
          <Link
            href={`/${team.slug}/highlights/${highlight.id}/editar`}
            className="inline-block mt-6 bg-panel border border-border rounded-lg px-4 py-2.5 text-sm font-bold hover:border-borderMuted"
          >
            Editar highlight
          </Link>
        )}

        {canDelete && (
          <ShareHighlightToggle highlightId={highlight.id} initial={Boolean(highlight.shared_with_team)} />
        )}

        {canDelete && <DeleteHighlightButton highlightId={highlight.id} teamSlug={team.slug} />}
      </div>
    </div>
  );
}
