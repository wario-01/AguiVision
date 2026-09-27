import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import StartStreamForm from "@/components/StartStreamForm";
import { getTeamBySlug } from "@/lib/data";

export default async function TransmitirPage({ params }: { params: { teamSlug: string } }) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();
  if (team.role !== "coach" && team.role !== "assistant") notFound();

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="inicio" />
      <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11 max-w-lg">
        <div className="font-display text-2xl font-bold mb-1">Transmitir en vivo</div>
        <div className="text-sm text-muted mb-7">{team.name}</div>
        <StartStreamForm teamSlug={team.slug} />
      </div>
    </div>
  );
}
