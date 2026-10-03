// app/[teamSlug]/evaluaciones/[cycleId]/page.tsx
//
// Lista a los jugadores del equipo para que el coach entre a calificar
// a cada uno dentro de este ciclo. Muestra también cuántos de los
// ítems de currículo ya tienen un nivel asignado, como progreso rápido.

import Link from 'next/link';
import { getTeamBySlug, getPlayers } from '@/lib/data';
import {
  getEvalCycle,
  getCurriculumItems,
  getFormativeEvaluationsForPlayer,
} from '@/lib/data-evaluaciones';

export default async function CicloDetallePage({
  params,
}: {
  params: { teamSlug: string; cycleId: string };
}) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) return <div className="p-8">Equipo no encontrado.</div>;

  const cycle = await getEvalCycle(params.cycleId);
  if (!cycle) return <div className="p-8">Ciclo no encontrado.</div>;

  const [players, curriculumItems] = await Promise.all([
    getPlayers(team.id),
    getCurriculumItems(cycle.id),
  ]);

  const totalItems = curriculumItems.length;

  const playersWithProgress = await Promise.all(
    players.map(async (player: any) => {
      const evaluated = await getFormativeEvaluationsForPlayer(player.id, cycle.id);
      return { ...player, completados: Object.keys(evaluated).length };
    })
  );

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <p className="text-sm text-gray-500 mb-1">
        <Link href={`/${team.slug}/evaluaciones`} className="underline">
          Evaluaciones
        </Link>{' '}
        / {cycle.name}
      </p>
      <h1 className="text-3xl font-bold mb-2" style={{ color: '#0A1830' }}>
        {cycle.name}
      </h1>
      <p className="text-gray-500 mb-8">
        {totalItems} ítems de currículo cargados
        {totalItems === 0 && ' — agrega currículo antes de calificar'}
      </p>

      <div className="flex flex-col gap-2">
        {playersWithProgress.map((player) => (
          <Link
            key={player.id}
            href={`/${team.slug}/evaluaciones/${cycle.id}/jugador/${player.id}`}
            className="flex items-center justify-between border rounded-xl p-4 hover:shadow-md transition"
            style={{ borderColor: '#D9D2BE' }}
          >
            <span className="font-semibold">{player.name}</span>
            <span className="text-sm text-gray-500">
              {player.completados} / {totalItems} calificados
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
