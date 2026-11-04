import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import HighlightAnnotator from "@/components/HighlightAnnotator";
import ReeditPanel from "@/components/ReeditPanel";
import { getTeamBySlug } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { cleanAnnotations } from "@/lib/annotations";
import { isR2Configured, r2ViewUrl } from "@/lib/r2";
import { BUILTIN_TRACKS } from "@/lib/music-library";

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

  // Video final (si las columnas aún no existen, se trata como "sin video final")
  let videoEdited = false;
  let finalStatus: string | null = null;
  try {
    const { data: f, error: fe } = await supabase.from("highlights").select("video_edited, final_status").eq("id", hl.id).maybeSingle();
    if (!fe) {
      videoEdited = Boolean((f as any)?.video_edited);
      finalStatus = ((f as any)?.final_status as string | null) ?? null;
    }
  } catch {}

  // Música: biblioteca del equipo y la canción elegida para este highlight
  let tracks: { id: string; title: string; url: string; builtin?: boolean }[] = BUILTIN_TRACKS.map((t) => ({ ...t, builtin: true }));
  let musicId: string | null = null;
  let musicVolume = 0.25;
  try {
    if (isR2Configured) {
      const { data: tr, error: te } = await supabase
        .from("music_tracks")
        .select("id, title, r2_key")
        .eq("team_id", team.id)
        .order("created_at", { ascending: true });
      if (!te) tracks = [...tracks, ...(tr ?? []).map((t: any) => ({ id: t.id, title: t.title, url: r2ViewUrl(t.r2_key) }))];
    }
  } catch {}
  try {
    const { data: m, error: me } = await supabase.from("highlights").select("music_id, music_volume").eq("id", hl.id).maybeSingle();
    if (!me) {
      musicId = ((m as any)?.music_id as string | null) ?? null;
      musicVolume = Number((m as any)?.music_volume) || 0.25;
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
        <div className="font-display text-2xl font-bold mb-4">Dibujos, voz y música</div>
        {missingColumn && (
          <div className="bg-panel border border-red rounded-xl px-4 py-3 mb-4 text-sm">
            Falta correr el SQL <b>highlights-dibujos.sql</b> en Supabase para poder guardar los dibujos.
          </div>
        )}
        {hl.clip_playback_id && videoEdited ? (
          <ReeditPanel teamSlug={team.slug} highlightId={hl.id} playbackId={hl.clip_playback_id} />
        ) : hl.clip_playback_id ? (
          <HighlightAnnotator
            teamSlug={team.slug}
            highlightId={hl.id}
            playbackId={hl.clip_playback_id}
            title={hl.label}
            initial={annotations}
            initialVoice={voice}
            r2Ready={isR2Configured}
            initialTracks={tracks}
            initialMusicId={musicId}
            initialFinalStatus={finalStatus}
            initialMusicVolume={musicVolume}
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
