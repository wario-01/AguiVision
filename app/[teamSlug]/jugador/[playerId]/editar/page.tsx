// app/[teamSlug]/jugador/[playerId]/editar/page.tsx

import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import PlayerInfoForm from "@/components/PlayerInfoForm";
import DeletePlayerButton from "@/components/DeletePlayerButton";
import LinkPlayerSection from "@/components/LinkPlayerSection";
import { getTeamBySlug } from "@/lib/data";
import { getPlayerProfile } from "@/lib/data-evaluaciones";
import { getLinkOptions } from "@/lib/data-personas";
import { getMeasurements } from "@/lib/data-crecimiento";

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

  const { linked, candidates } = await getLinkOptions(player.person_id, team.id);

  // Edad estimada hoy: la de la última medición + los meses que han pasado desde entonces.
  const measurements = await getMeasurements(player.id);
  const lastWithAge = [...measurements].reverse().find((m) => m.age_months !== null);
  let ageToday: number | null = null;
  if (lastWithAge && lastWithAge.age_months !== null) {
    const monthsSince = Math.max(
      0,
      Math.floor((Date.now() - new Date(lastWithAge.measured_on + "T00:00:00Z").getTime()) / (30.4375 * 24 * 3600 * 1000))
    );
    ageToday = Math.floor(lastWithAge.age_months) + monthsSince;
  }
  const sexToday = player.sex ?? lastWithAge?.sex ?? null;

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
            full_name: player.full_name,
            jersey_number: player.jersey_number,
            position: player.position,
            peso: player.peso,
            altura: player.altura,
            cintura: player.cintura,
            perfil: player.perfil,
            age_months: ageToday,
            sex: sexToday,
          }}
        />

        <LinkPlayerSection playerId={player.id} linked={linked} candidates={candidates} />

        <div className="mt-6">
          <DeletePlayerButton playerId={player.id} playerName={player.full_name} teamSlug={team.slug} />
        </div>
      </div>
    </div>
  );
}
