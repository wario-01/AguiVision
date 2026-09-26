import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import UploadForm from "@/components/UploadForm";
import { getTeamBySlug } from "@/lib/data";

export default async function SubirPage({ params }: { params: { teamSlug: string } }) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="subir" />
      <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11 max-w-2xl">
        <div className="font-display text-2xl font-bold mb-1">Subir video</div>
        <div className="text-sm text-muted mb-7">{team.name} · sube el video completo del partido</div>
        <UploadForm teamSlug={team.slug} />
      </div>
    </div>
  );
}
