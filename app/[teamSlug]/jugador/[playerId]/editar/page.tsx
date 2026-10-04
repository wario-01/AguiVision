// app/[teamSlug]/jugador/[playerId]/editar/page.tsx

import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import PlayerInfoForm from "@/components/PlayerInfoForm";
import { getTeamBySlug } from "@/lib/data";
import { getPlayerProfile } from "@/lib/data-evaluaciones";

export default async function EditarJugadorPage({
  params,
}: {
  params: { teamSlug: string; playerId: string };
}) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();

  const canEdit = team.role === "coach" || team.role === "assistant";
  if (!canEdit) notFound();

  const player = await getPlayerProfile(params.playerId);
  if (!player || player.team_id !== team.id) notFound();

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="equipo" />
      <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11 max-w-2xl">
        <div className="text-xs text-muted mb-1">
          <Link href={`/${team.slug}/jugador/${player.id}`} className="font-bold hover:text-text">
            {player.full_name}
          </Link>{" "}
          / Editar datos
        </div>
        <div className="font-display text-2xl font-bold mb-6">Editar datos de {player.full_name}</div>

        <PlayerInfoForm
          playerId={player.id}
          teamSlug={team.slug}
          initial={{
            jersey_number: player.jersey_number,
            position: player.position,
            peso: player.peso,
            altura: player.altura,
            perfil: player.perfil,
          }}
        />
      </div>
    </div>
  );
}
