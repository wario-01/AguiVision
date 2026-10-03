// app/[teamSlug]/evaluaciones/page.tsx
//
// Lista los ciclos de evaluación formativa del equipo. Si el usuario
// es coach, muestra el botón "Nuevo ciclo". team.role ya viene
// resuelto por getTeamBySlug() (lo trae de getMyTeams()).

import Link from 'next/link';
import { getTeamBySlug } from '@/lib/data';
import { getEvalCycles } from '@/lib/data-evaluaciones';

export default async function EvaluacionesPage({
  params,
}: {
  params: { teamSlug: string };
}) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) {
    return <div className="p-8">Equipo no encontrado.</div>;
  }

  const isCoach = team.role === 'coach';
  const cycles = await getEvalCycles(team.id);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold" style={{ color: '#0A1830' }}>
          Evaluación del jugador
        </h1>
        {isCoach && (
          <Link
            href={`/${team.slug}/evaluaciones/nuevo`}
            className="px-5 py-2.5 rounded-lg font-semibold text-sm"
            style={{ background: '#0A1830', color: '#F5EFD6' }}
          >
            + Nuevo ciclo
          </Link>
        )}
      </div>

      {cycles.length === 0 ? (
        <p className="text-gray-500">
          Todavía no hay ciclos de evaluación para {team.name}.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {cycles.map((cycle) => (
            <Link
              key={cycle.id}
              href={`/${team.slug}/evaluaciones/${cycle.id}`}
              className="block border rounded-xl p-5 hover:shadow-md transition"
              style={{ borderColor: '#D9D2BE' }}
            >
              <p className="font-bold text-lg">{cycle.name}</p>
              <p className="text-sm text-gray-500">
                {cycle.start_date} — {cycle.end_date} · {cycle.period_type}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
