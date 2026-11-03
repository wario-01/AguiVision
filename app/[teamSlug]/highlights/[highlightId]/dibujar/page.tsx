import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import HighlightAnnotator from "@/components/HighlightAnnotator";
import { getTeamBySlug } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { cleanAnnotations } from "@/lib/annotations";
import { isR2Configured, r2ViewUrl } from "@/lib/r2";

export default async function DibujarHighlightPage({
  params,
}: {
  params: { teamSlug: string; highlightId: string };
}) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();
  if (team.role !== "coach" && team.role !== "assistant") notFound();

  const supabase = await createClient();
  if (!supabase) notFound();
  const { data: hl } = await supabase
    .from("highlights")
    .select("id, label, clip_playback_id, matches!inner(team_id)")
    .eq("id", params.highlightId)
    .maybeSingle();
  if (!hl || (hl as any).matches?.team_id !== team.id) notFound();

  // La columna "annotations" puede no existir todavía (falta correr el SQL): usamos lista vacía.
  let annotations: ReturnType<typeof cleanAnnotations> = [];
  let missingColumn = false;
  try {
    const { data, error } = await supabase.from("highlights").select("annotations").eq("id", hl.id).maybeSingle();
    if (error) missingColumn = true;
    else annotations = cleanAnnotations((data as any)?.annotations);
  } catch {
    missingColumn = true;
  }

  let voice: { url: string; start: number } | null = null;
  try {
    if (isR2Configured) {
      const { data, error } = await supabase.from("highlights").select("voice_key, voice_start").eq("id", hl.id).maybeSingle();
      const key = (data as any)?.voice_key as string | null | undefined;
      if (!error && key) voice = { url: r2ViewUrl(key), start: Number((data as any).voice_start) || 0 };
    }
  } catch {}

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="highlights" />
      <div className="flex-grow overflow-y-auto px-4 pt-24 pb-24 md:p-9 max-w-6xl">
        <div className="text-xs text-muted mb-1">
          <Link href={`/${team.slug}/highlights/${hl.id}`} className="font-bold hover:text-text">
            {hl.label}
          </Link>{" "}
          / Dibujar
        </div>
        <div className="font-display text-2xl font-bold mb-4">Dibujos y voz</div>
        {missingColumn && (
          <div className="bg-panel border border-red rounded-xl px-4 py-3 mb-4 text-sm">
            Falta correr el SQL <b>highlights-dibujos.sql</b> en Supabase para poder guardar los dibujos.
          </div>
        )}
        {hl.clip_playback_id ? (
          <HighlightAnnotator
            teamSlug={team.slug}
            highlightId={hl.id}
            playbackId={hl.clip_playback_id}
            title={hl.label}
            initial={annotations}
            initialVoice={voice}
            r2Ready={isR2Configured}
          />
        ) : (
          <div className="border border-dashed border-borderMuted rounded-2xl p-10 text-center text-muted text-sm">
            El clip todavía se está procesando. Vuelve en un rato.
          </div>
        )}
      </div>
    </div>
  );
}
