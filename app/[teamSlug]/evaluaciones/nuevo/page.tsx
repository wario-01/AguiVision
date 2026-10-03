import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getTeamBySlug } from "@/lib/data";
import NewCycleForm from "@/components/NewCycleForm";

export default async function NuevoCicloPage({
  params,
}: {
  params: { teamSlug: string };
}) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="evaluaciones" />
      <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11 max-w-2xl">
        <div className="font-display text-2xl font-bold mb-1">Nuevo ciclo de evaluación</div>
        <div className="text-sm text-muted mb-6">{team.name}</div>
        <NewCycleForm teamId={team.id} teamSlug={team.slug} />
      </div>
    </div>
  );
}
