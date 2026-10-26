import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import PhotoGallery, { GalleryPhoto } from "@/components/PhotoGallery";
import { getTeamBySlug, getCurrentUser } from "@/lib/data";
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
          .select("id, album, album_date, thumb_key, file_name, keep, uploaded_by, created_at")
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
    }));
  }

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="fotos" />
      <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11">
        <div className="font-display text-2xl font-bold mb-1">Fotos</div>
        <div className="text-sm text-muted mb-6">
          {team.name} · las fotos se borran solas a los 60 días, salvo las marcadas con “Guardar”
        </div>
        {!isR2Configured ? (
          <div className="text-sm text-muted">Falta conectar el almacenamiento de fotos.</div>
        ) : (
          <PhotoGallery teamSlug={team.slug} photos={photos} canManage={isStaff} />
        )}
      </div>
    </div>
  );
}
