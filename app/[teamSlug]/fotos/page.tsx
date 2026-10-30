import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import PhotoGallery, { GalleryPhoto } from "@/components/PhotoGallery";
import { getTeamBySlug, getCurrentUser, getMatches, getPlayers } from "@/lib/data";
import { clubParts } from "@/lib/tz";
import { createClient } from "@/lib/supabase/server";
import { isR2Configured, r2ViewUrl } from "@/lib/r2";

export default async function FotosPage({ params }: { params: { teamSlug: string } }) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();
  const isStaff = team.role === "coach" || team.role === "assistant";
  if (!isStaff && team.role !== "collaborator" && !team.photo_access) notFound();

  const user = await getCurrentUser();
  let photos: GalleryPhoto[] = [];
  if (isR2Configured) {
    const supabase = await createClient();
    const { data } = supabase
      ? await supabase
          .from("photos")
          .select("*")
          .eq("team_id", team.id)
          .order("album_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(600)
      : { data: null };
    photos = (data ?? []).map((p: any) => ({
      id: p.id,
      album: p.album,
      albumDate: p.album_date,
      thumbUrl: r2ViewUrl(p.thumb_key),
      fileName: p.file_name,
      keep: p.keep,
      mine: p.uploaded_by === user?.id,
      kind: p.kind === "video" ? "video" : "photo",
      durationSeconds: p.duration_seconds ?? null,
      highlightId: p.highlight_id ?? null,
      matchId: p.match_id ?? null,
    }));
  }

  // Para marcar un video como highlight (solo entrenador/asistente).
  const matchOpts = isStaff
    ? (await getMatches(team.slug)).slice(0, 30).map((m) => ({
        id: m.id,
        label: `vs ${m.opponent} · ${clubParts(m.match_date).ymd}`,
      }))
    : [];
  const playerOpts = isStaff ? (await getPlayers(team.slug)).map((pl) => ({ id: pl.id, name: pl.full_name })) : [];

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="fotos" />
      <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11">
        <div className="font-display text-2xl font-bold mb-1">Fotos y videos</div>
        <div className="text-sm text-muted mb-6">
          {team.name} · las fotos y videos se borran solos a los 60 días, salvo las marcadas con “Guardar”
        </div>
        {!isR2Configured ? (
          <div className="text-sm text-muted">Falta conectar el almacenamiento de fotos.</div>
        ) : (
          <PhotoGallery teamSlug={team.slug} photos={photos} canManage={isStaff} matches={matchOpts} players={playerOpts} />
        )}
      </div>
    </div>
  );
}
