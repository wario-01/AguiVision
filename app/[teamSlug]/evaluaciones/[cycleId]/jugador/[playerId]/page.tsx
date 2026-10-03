// app/[teamSlug]/evaluaciones/[cycleId]/jugador/[playerId]/page.tsx

import Link from 'next/link';
import { getTeamBySlug, getPlayerById } from '@/lib/data';
import {
  getEvalCycle,
  getCurriculumItems,
  groupCurriculumByPeriod,
  getFormativeEvaluationsForPlayer,
} from '@/lib/data-evaluaciones';
import PlayerEvalForm from '@/components/PlayerEvalForm';

export default async function EvaluarJugadorPage({
  params,
}: {
  params: { teamSlug: string; cycleId: string; playerId: string };
}) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) return <div className="p-8">Equipo no encontrado.</div>;

  const cycle = await getEvalCycle(params.cycleId);
  if (!cycle) return <div className="p-8">Ciclo no encontrado.</div>;

  // AJUSTA: si tu lib/data.ts no tiene getPlayerById, usa la función
  // equivalente que ya tengas para traer un jugador por id (por
  // ejemplo filtrando el resultado de getPlayers).
  const player = await getPlayerById(params.playerId);
  if (!player) return <div className="p-8">Jugador no encontrado.</div>;

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
    <div className="max-w-2xl mx-auto px-6 py-10">
      <p className="text-sm text-gray-500 mb-1">
        <Link href={`/${team.slug}/evaluaciones/${cycle.id}`} className="underline">
          {cycle.name}
        </Link>
      </p>
      <h1 className="text-3xl font-bold mb-8" style={{ color: '#0A1830' }}>
        {player.name}
      </h1>

      {groups.length === 0 ? (
        <p className="text-gray-500">
          Este ciclo todavía no tiene currículo cargado.
        </p>
      ) : (
        <PlayerEvalForm
          playerId={player.id}
          groups={groups}
          evaluaciones={evaluacionesSimples}
        />
      )}
    </div>
  );
}
