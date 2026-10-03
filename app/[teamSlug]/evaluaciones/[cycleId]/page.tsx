import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getTeamBySlug, getPlayers } from "@/lib/data";
import {
  getEvalCycle,
  getCurriculumItems,
  getFormativeEvaluationsForPlayer,
} from "@/lib/data-evaluaciones";

export default async function CicloDetallePage({
  params,
}: {
  params: { teamSlug: string; cycleId: string };
}) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();

  const cycle = await getEvalCycle(params.cycleId);
  if (!cycle) notFound();

  const [players, curriculumItems] = await Promise.all([
    getPlayers(team.slug),
    getCurriculumItems(cycle.id),
  ]);

  const totalItems = curriculumItems.length;

  const playersWithProgress = await Promise.all(
    players.map(async (player) => {
      const evaluated = await getFormativeEvaluationsForPlayer(player.id, cycle.id);
      return { ...player, completados: Object.keys(evaluated).length };
    })
  );

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="evaluaciones" />
      <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11 max-w-2xl">
        <div className="text-xs text-muted mb-1">
          <Link href={`/${team.slug}/evaluaciones`} className="font-bold hover:text-text">
            Evaluaciones
          </Link>{" "}
          / {cycle.name}
        </div>
        <div className="font-display text-2xl font-bold mb-1">{cycle.name}</div>
        <div className="text-sm text-muted mb-6">
          {totalItems} ítems de currículo cargados
          {totalItems === 0 && " — agrega currículo antes de calificar"}
        </div>

        <div className="flex flex-col gap-2">
          {playersWithProgress.map((player) => (
            <Link
              key={player.id}
              href={`/${team.slug}/evaluaciones/${cycle.id}/jugador/${player.id}`}
              className="flex items-center justify-between bg-panel border border-border rounded-xl px-4 py-3.5 hover:border-borderMuted transition"
            >
              <span className="font-bold text-sm">{player.full_name}</span>
              <span className="text-xs text-muted">
                {player.completados} / {totalItems} calificados
              </span>
            </Link>
          ))}
          {players.length === 0 && (
            <div className="text-sm text-muted border border-dashed border-borderMuted rounded-2xl p-8 text-center">
              Este equipo todavía no tiene jugadores.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
