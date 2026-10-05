// app/[teamSlug]/evaluaciones/fisico/[playerId]/page.tsx

import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getTeamBySlug, getPlayers } from "@/lib/data";
import {
  getPhysicalEvalEnabled,
  getPhysicalMetrics,
  getPhysicalResultsForPlayer,
} from "@/lib/data-evaluaciones";
import PhysicalResultForm from "@/components/PhysicalResultForm";

export default async function FisicoJugadorPage({
  params,
}: {
  params: { teamSlug: string; playerId: string };
}) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();
  // Datos de menores: solo entrenador/asistente.
  if (team.role !== "coach" && team.role !== "assistant") notFound();

  const enabled = await getPhysicalEvalEnabled(team.id);
  if (!enabled) notFound();

  const players = await getPlayers(team.slug);
  const player = players.find((p) => p.id === params.playerId);
  if (!player) notFound();

  const [metrics, historial] = await Promise.all([
    getPhysicalMetrics(team.id),
    getPhysicalResultsForPlayer(player.id),
  ]);

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="evaluaciones" />
      <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11 max-w-2xl">
        <div className="text-xs text-muted mb-1">
          <Link href={`/${team.slug}/evaluaciones/fisico`} className="font-bold hover:text-text">
            Físico-técnica
          </Link>
        </div>
        <div className="font-display text-2xl font-bold mb-6">{player.full_name}</div>

        {metrics.length === 0 ? (
          <div className="text-sm text-muted border border-dashed border-borderMuted rounded-2xl p-8 text-center">
            Este equipo todavía no tiene métricas configuradas.
          </div>
        ) : (
          <PhysicalResultForm playerId={player.id} metrics={metrics} historial={historial} />
        )}
      </div>
    </div>
  );
}
