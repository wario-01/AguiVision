// app/[teamSlug]/jugador/nuevo/page.tsx

import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import PlayerInfoForm from "@/components/PlayerInfoForm";
import { getTeamBySlug } from "@/lib/data";

export default async function NuevoJugadorPage({ params }: { params: { teamSlug: string } }) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();
  if (team.role !== "coach" && team.role !== "assistant") notFound();

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="equipo" />
      <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11 max-w-2xl">
        <div className="text-xs text-muted mb-1">
          <Link href={`/${team.slug}/equipo`} className="font-bold hover:text-text">
            Equipo
          </Link>{" "}
          / Nuevo jugador
        </div>
        <div className="font-display text-2xl font-bold mb-6">Nuevo jugador en {team.name}</div>

        <PlayerInfoForm
          teamId={team.id}
          teamSlug={team.slug}
          initial={{ full_name: "", jersey_number: null, position: null, peso: null, altura: null, perfil: null }}
        />
      </div>
    </div>
  );
}
