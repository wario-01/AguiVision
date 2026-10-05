import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getTeamBySlug, getPlayers } from "@/lib/data";
import {
  getEvalCycle,
  getCurriculumItems,
  groupCurriculumByPeriod,
  getFormativeEvaluationsForPlayer,
} from "@/lib/data-evaluaciones";
import PlayerEvalForm from "@/components/PlayerEvalForm";

export default async function EvaluarJugadorPage({
  params,
}: {
  params: { teamSlug: string; cycleId: string; playerId: string };
}) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();

  const cycle = await getEvalCycle(params.cycleId);
  if (!cycle) notFound();

  const players = await getPlayers(team.slug);
  const player = players.find((p) => p.id === params.playerId);
  if (!player) notFound();

  const [items, evaluaciones] = await Promise.all([
    getCurriculumItems(cycle.id),
    getFormativeEvaluationsForPlayer(player.id, cycle.id),
  ]);

  const groups = groupCurriculumByPeriod(items);

  const evaluacionesSimples: Record<string, { nivel: string; notas: string | null }> = {};
  for (const [itemId, ev] of Object.entries(evaluaciones)) {
    evaluacionesSimples[itemId] = { nivel: ev.nivel, notas: ev.notas };
  }

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="evaluaciones" />
      <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11 max-w-2xl">
        <div className="text-xs text-muted mb-1">
          <Link
            href={`/${team.slug}/evaluaciones/${cycle.id}`}
            className="font-bold hover:text-text"
          >
            {cycle.name}
          </Link>
        </div>
        <div className="font-display text-2xl font-bold mb-6">{player.full_name}</div>

        {groups.length === 0 ? (
          <div className="text-sm text-muted border border-dashed border-borderMuted rounded-2xl p-8 text-center">
            Este ciclo todavía no tiene currículo cargado.
          </div>
        ) : (
          <PlayerEvalForm
            playerId={player.id}
            groups={groups}
            evaluaciones={evaluacionesSimples}
          />
        )}

        <div className="flex items-center gap-3 mt-8">
          <Link
            href={`/${team.slug}/evaluaciones/${cycle.id}`}
            className="bg-gold text-bg rounded-lg px-5 py-2.5 text-sm font-extrabold"
          >
            Volver a la lista
          </Link>
          <Link
            href={`/${team.slug}/jugador/${player.id}`}
            className="text-xs font-bold text-gold hover:underline"
          >
            Ver perfil
          </Link>
        </div>
      </div>
    </div>
  );
}
