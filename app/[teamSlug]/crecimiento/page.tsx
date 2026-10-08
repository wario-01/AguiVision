// app/[teamSlug]/crecimiento/page.tsx
//
// IMC e historial de crecimiento del jugador, para su familia (papá/mamá o
// jugador vinculado). El cuerpo técnico lo ve en el perfil del jugador.

import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import GrowthSection from "@/components/GrowthSection";
import { getTeamBySlug, getPlayers } from "@/lib/data";
import { getMeasurements } from "@/lib/data-crecimiento";

export default async function CrecimientoPage({ params }: { params: { teamSlug: string } }) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();
  if ((team.role !== "parent" && team.role !== "player") || !team.player_id) notFound();

  const players = await getPlayers(team.slug);
  const me = players.find((p) => p.id === team.player_id);
  const measurements = await getMeasurements(team.player_id);

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="crecimiento" />
      <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11 max-w-2xl">
        <div className="font-display text-2xl font-bold mb-1">Crecimiento</div>
        <div className="text-sm text-muted mb-6">
          {me?.full_name ?? "Jugador"} · {team.name}
        </div>
        <GrowthSection measurements={measurements} audience="familia" />
      </div>
    </div>
  );
}
